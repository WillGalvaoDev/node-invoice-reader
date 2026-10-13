// Ensaio ISOLADO de reconstrução e rollback (DP-04, D02/D07). Nunca usa DATABASE_URL do
// ambiente: o banco é sempre o PostgreSQL efêmero de docker-compose.test.yml.
//
//   1. banco vazio -> migrations do candidato -> API candidata -> smoke (2x, idempotente)
//   2. API da release ANTERIOR sobre o schema novo -> smoke sem demo
//   3. volta ao candidato -> smoke
//
// Uso: node scripts/rehearse-release.mjs [--previous <git-sha>]   (padrão: HEAD do checkout)
// Exige Docker e `npm run build`. Não chama IA: o Gemini é apontado para uma porta fechada e
// o ensaio confere que nenhum evento/ledger de IA foi criado.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSmoke } from './smoke-demo.mjs';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const composeFile = 'docker-compose.test.yml';
const databaseUrl = 'postgresql://docscan_test:docscan_test_only@127.0.0.1:55432/docscan_integration_test';
const port = 3350;
const baseUrl = `http://127.0.0.1:${port}`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const argumentIndex = process.argv.indexOf('--previous');
const previousRef = argumentIndex > -1 ? process.argv[argumentIndex + 1] : 'HEAD';
const account = {
  email: `ensaio-${Date.now()}@example.test`,
  password: 'ensaio-senha-segura-123',
  inviteCode: 'convite-ensaio-123',
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: rootDir,
    shell: process.platform === 'win32' && command === npm,
    ...options,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} falhou (${result.status ?? 'sem status'}).`);
}

function psql(sql) {
  const result = spawnSync('docker', [
    'compose', '-f', composeFile, 'exec', '-T', 'postgres-test',
    'psql', '-U', 'docscan_test', '-d', 'docscan_integration_test', '-tA', '-c', sql,
  ], { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`psql falhou: ${result.stderr}`);
  return result.stdout.trim();
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('API não respondeu ao health.');
}

function startApi(directory, extra = {}) {
  return spawn(process.execPath, ['src/index.js'], {
    cwd: directory,
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      JWT_SECRET: 'ensaio-jwt-secret-com-pelo-menos-32-chars',
      GEMINI_API_KEY: 'ensaio-sem-ia',
      INVITE_CODE: account.inviteCode,
      PORT: String(port),
      DEMO_ENABLED: 'true',
      // Qualquer chamada de IA falharia: o ensaio não pode consumir provedor.
      GOOGLE_GEMINI_BASE_URL: 'http://127.0.0.1:9',
      ...extra,
    },
  });
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolveStop) => child.once('exit', resolveStop));
}

const timeline = [];
const mark = (label, startedAt) => timeline.push({ label, seconds: Number(((performance.now() - startedAt) / 1000).toFixed(1)) });
const expectOk = (name, outcome) => {
  if (!outcome.ok) throw new Error(`${name} falhou: ${JSON.stringify(outcome.results.filter((item) => !item.ok))}`);
  return outcome;
};

let worktree;
let child;
let succeeded = false;
const total = performance.now();

try {
  const previousSha = spawnSync('git', ['rev-parse', previousRef], { cwd: rootDir, encoding: 'utf8' }).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(previousSha)) throw new Error(`Referência anterior inválida: ${previousRef}`);

  let started = performance.now();
  run('docker', ['compose', '-f', composeFile, 'down', '--volumes', '--remove-orphans']);
  run('docker', ['compose', '-f', composeFile, 'up', '--detach', '--wait']);
  mark('banco efêmero vazio no ar', started);

  started = performance.now();
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: databaseUrl } });
  mark('migrations do candidato aplicadas do zero', started);

  started = performance.now();
  child = startApi(rootDir);
  await waitForHealth();
  mark('API candidata respondeu ao health', started);

  started = performance.now();
  const first = expectOk('smoke candidato #1', await runSmoke({ baseUrl, ...account }));
  const second = expectOk('smoke candidato #2', await runSmoke({ baseUrl, ...account }));
  mark('conta + sessão + PDF + consulta (2 execuções)', started);

  const companies = Number(psql('SELECT count(*) FROM companies'));
  const sessions = Number(psql('SELECT count(*) FROM demo_sessions'));
  const aiEvents = Number(psql('SELECT count(*) FROM ai_call_events'));
  const ledgerRows = Number(psql('SELECT count(*) FROM ai_usage_ledger'));
  if (companies !== 1 || sessions !== 1) throw new Error(`Repetição multiplicou registros (empresas=${companies}, sessões=${sessions}).`);
  if (aiEvents !== 0 || ledgerRows !== 0) throw new Error(`Smoke gerou atividade de IA (eventos=${aiEvents}, ledger=${ledgerRows}).`);
  await stop(child);

  // Release anterior sobre o schema novo.
  started = performance.now();
  worktree = mkdtempSync(join(tmpdir(), 'docscan-previous-'));
  run('git', ['worktree', 'add', '--detach', worktree, previousSha]);
  run(npm, ['ci', '--no-audit', '--no-fund'], { cwd: worktree });
  run(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], { cwd: worktree, env: { ...process.env, DATABASE_URL: databaseUrl } });
  mark(`release anterior (${previousSha.slice(0, 7)}) preparada`, started);

  started = performance.now();
  child = startApi(worktree);
  await waitForHealth();
  const previous = expectOk('smoke release anterior', await runSmoke({ baseUrl, ...account, demo: false, version: false }));
  mark('release anterior sobre schema novo: smoke sem demo', started);
  await stop(child);

  // De volta ao candidato.
  started = performance.now();
  child = startApi(rootDir);
  await waitForHealth();
  const back = expectOk('smoke candidato após rollback', await runSmoke({ baseUrl, ...account }));
  mark('retorno ao candidato: smoke', started);

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    previousSha,
    isolatedDatabase: true,
    counts: { companies, sessions, aiEvents, ledgerRows },
    smoke: { candidate1: first.results.map((r) => [r.name, r.ok, r.ms]), candidate2: second.results.length, previous: previous.results.map((r) => [r.name, r.ok, r.ms]), backToCandidate: back.results.length },
    timeline,
    totalSeconds: Number(((performance.now() - total) / 1000).toFixed(1)),
  }, null, 2));
  succeeded = true;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await stop(child);
  if (worktree) {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: rootDir });
    rmSync(worktree, { recursive: true, force: true });
  }
  spawnSync('docker', ['compose', '-f', composeFile, 'down', '--volumes', '--remove-orphans'], { cwd: rootDir, stdio: 'inherit' });
}

process.exit(succeeded ? 0 : 1);
