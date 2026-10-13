// Smoke idempotente do ambiente de demonstração — NUNCA chama IA.
//
// Verifica: health, versão, login (registra a conta de teste se houver convite e ela não
// existir), preparo/reuso da sessão, download do PDF e consulta de produtos. Repetir não
// multiplica empresas nem sessões: `POST /demo/sessions` reutiliza a sessão ativa.
//
// Uso: SMOKE_BASE_URL=https://... SMOKE_EMAIL=... SMOKE_PASSWORD=... [SMOKE_INVITE_CODE=...] \
//      [SMOKE_EXPECT_SHA=<sha>] [SMOKE_SKIP_DEMO=true] [SMOKE_SKIP_VERSION=true] node scripts/smoke-demo.mjs
// (SKIP_* servem para validar um rollback para release anterior, sem /demo nem /version)
// Nada é impresso além de nomes de verificação, status e tempos: sem token, senha ou convite.
import { pathToFileURL } from 'node:url';

export async function runSmoke({
  baseUrl,
  email,
  password,
  inviteCode,
  expectSha,
  expectWebSha = false,
  demo = true,
  version = true,
  fetchImpl = fetch,
}) {
  const results = [];
  const base = baseUrl.replace(/\/+$/, '');

  async function check(name, action) {
    const startedAt = performance.now();
    try {
      const detail = await action();
      results.push({ name, ok: true, ms: Math.round(performance.now() - startedAt), ...(detail && { detail }) });
    } catch (error) {
      results.push({ name, ok: false, ms: Math.round(performance.now() - startedAt), error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  const call = async (path, init = {}) => {
    const response = await fetchImpl(`${base}${path}`, init);
    return response;
  };
  const expectStatus = (response, ...allowed) => {
    if (!allowed.includes(response.status)) throw new Error(`HTTP ${response.status} (esperado ${allowed.join('/')})`);
  };

  let token = '';
  let session;

  try {
    await check('health', async () => {
      const response = await call('/health');
      expectStatus(response, 200);
      const body = await response.json();
      if (body.status !== 'ok') throw new Error('corpo inesperado');
    });

    if (version) {
      await check('version', async () => {
        const response = await call('/version');
        expectStatus(response, 200);
        const { data } = await response.json();
        if (expectSha && data.api.sha !== expectSha.toLowerCase()) {
          throw new Error(`SHA da API (${data.api.sha}) difere do esperado (${expectSha})`);
        }
        if (expectWebSha && expectSha && data.web?.sha !== expectSha.toLowerCase()) {
          throw new Error(`SHA da interface (${data.web?.sha ?? 'ausente'}) difere do esperado`);
        }
        return { api: data.api.sha, web: data.web?.sha ?? null };
      });
    }

    await check('login', async () => {
      const attempt = () => call('/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      let response = await attempt();
      if (response.status === 401 && inviteCode) {
        const registration = await call('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Smoke Teste', email, password, inviteCode }),
        });
        expectStatus(registration, 201, 409);
        response = await attempt();
      }
      expectStatus(response, 200);
      token = (await response.json()).data.token;
    });

    const authorized = { authorization: `Bearer ${token}` };

    await check('discovery (empresas)', async () => {
      const response = await call('/companies', { headers: authorized });
      expectStatus(response, 200);
      const { data } = await response.json();
      if (!Array.isArray(data.items)) throw new Error('lista de empresas ausente');
    });

    if (demo) {
      await check('sessão de demonstração (preparar/reutilizar)', async () => {
        const response = await call('/demo/sessions', {
          method: 'POST', headers: { ...authorized, 'content-type': 'application/json' }, body: '{}',
        });
        expectStatus(response, 200, 201);
        session = (await response.json()).data.session;
        return { created: response.status === 201 };
      });

      await check('sessão atual coincide', async () => {
        const response = await call('/demo/sessions/current', { headers: authorized });
        expectStatus(response, 200);
        if ((await response.json()).data.session.id !== session.id) throw new Error('sessão divergente');
      });

      await check('download do PDF inicial', async () => {
        const response = await call(`/demo/sessions/${session.id}/documents/initial`, { headers: authorized });
        expectStatus(response, 200);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('não é um PDF');
        if (response.headers.get('cache-control') !== 'no-store') throw new Error('Cache-Control ausente');
      });

      await check('consulta de produtos (sem IA)', async () => {
        const response = await call(`/products?stockId=${session.stockId}&limit=50`, { headers: authorized });
        expectStatus(response, 200);
        const { data } = await response.json();
        if (!Array.isArray(data.items)) throw new Error('lista de produtos ausente');
        return { items: data.items.length };
      });
    }
  } catch {
    return { ok: false, results };
  }
  return { ok: true, results };
}

async function main() {
  const required = ['SMOKE_BASE_URL', 'SMOKE_EMAIL', 'SMOKE_PASSWORD'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Variáveis ausentes: ${missing.join(', ')}`);
    process.exit(2);
  }

  const outcome = await runSmoke({
    baseUrl: process.env.SMOKE_BASE_URL,
    email: process.env.SMOKE_EMAIL,
    password: process.env.SMOKE_PASSWORD,
    ...(process.env.SMOKE_INVITE_CODE && { inviteCode: process.env.SMOKE_INVITE_CODE }),
    ...(process.env.SMOKE_EXPECT_SHA && { expectSha: process.env.SMOKE_EXPECT_SHA, expectWebSha: true }),
    demo: process.env.SMOKE_SKIP_DEMO !== 'true',
    version: process.env.SMOKE_SKIP_VERSION !== 'true',
  });

  console.log(JSON.stringify({ at: new Date().toISOString(), ok: outcome.ok, results: outcome.results }, null, 2));
  process.exit(outcome.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
