// Orquestra o E2E de navegador: PostgreSQL efêmero (Docker) + backend real (artefato
// compilado) + interface web construída + Gemini determinístico separado + Playwright.
//
// Pré-requisito: `npm run build` na raiz (artefato do backend) e dependências instaladas
// em `web/`. Nunca aponta para um banco que não seja o efêmero de docker-compose.test.yml.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = resolve(webDir, '..');
const composeFile = 'docker-compose.test.yml';
const databaseUrl = 'postgresql://docscan_test:docscan_test_only@127.0.0.1:55432/docscan_integration_test';
const apiPort = Number(process.env.E2E_API_PORT ?? 3341);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' && command === npm, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} falhou (${result.status ?? 'sem status'}).`);
}

async function waitForHealth(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // serviço ainda subindo
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Serviço não respondeu em ${url}.`);
}

const children = [];
let exitCode = 1;

try {
  run(npm, ['run', 'build'], { cwd: webDir });
  run('docker', ['compose', '-f', composeFile, 'down', '--volumes', '--remove-orphans'], { cwd: rootDir });
  run('docker', ['compose', '-f', composeFile, 'up', '--detach', '--wait'], { cwd: rootDir });
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: rootDir, env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const gemini = spawn(process.execPath, ['e2e/fake-gemini.mjs'], { cwd: webDir, stdio: ['ignore', 'pipe', 'inherit'] });
  children.push(gemini);
  const [chunk] = await once(gemini.stdout, 'data');
  const geminiPort = Number(String(chunk).trim());
  const geminiUrl = `http://127.0.0.1:${geminiPort}`;

  const api = spawn(process.execPath, ['src/index.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      JWT_SECRET: 'e2e-only-jwt-secret-with-at-least-32-chars',
      GEMINI_API_KEY: 'e2e-only-gemini-key',
      INVITE_CODE: 'convite-e2e-123',
      PORT: String(apiPort),
      DEMO_ENABLED: 'true',
      GEMINI_ENABLED: 'true',
      GEMINI_QUOTA_ENFORCEMENT_ENABLED: 'false',
      GEMINI_MAX_ATTEMPTS: '1',
      // Somente aqui o SDK é redirecionado para o Gemini determinístico do E2E.
      GOOGLE_GEMINI_BASE_URL: geminiUrl,
    },
  });
  children.push(api);
  await waitForHealth(`http://127.0.0.1:${apiPort}/health`);

  const tests = spawnSync(npm, ['exec', '--', 'playwright', 'test', '--config', 'e2e/playwright.config.ts'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      E2E_BASE_URL: `http://127.0.0.1:${apiPort}`,
      E2E_GEMINI_CONTROL_URL: geminiUrl,
    },
  });
  exitCode = tests.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  for (const child of children) child.kill();
  spawnSync('docker', ['compose', '-f', composeFile, 'down', '--volumes', '--remove-orphans'], { cwd: rootDir, stdio: 'inherit' });
}

process.exit(exitCode);
