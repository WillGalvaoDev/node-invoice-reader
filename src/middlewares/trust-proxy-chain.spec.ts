import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from './error-handler.js';
import { createIpRateLimiter } from './auth-rate-limiters.js';
import { configureTrustProxy } from '../config/trust-proxy.js';

/**
 * D03 — cadeia real do Render: visitante → Cloudflare → balanceador do Render → app.
 * O balanceador acrescenta o endereço que o conectou (a borda do Cloudflare) ao
 * `X-Forwarded-For`, e o Cloudflare acrescenta o IP do visitante ao valor que chegou.
 * Em 127.0.0.1 o "balanceador" é o próprio socket do teste.
 */
const EDGE_A = '172.70.10.1';
const EDGE_B = '172.71.20.2';
const VISITOR_1 = '203.0.113.1';
const VISITOR_2 = '203.0.113.2';
const FORGED_1 = '6.6.6.6';
const FORGED_2 = '7.7.7.7';

const chain = (...hops: string[]) => ({ 'x-forwarded-for': hops.join(', ') });

const servers: Server[] = [];

async function listen(app: Express): Promise<string> {
  const server = await new Promise<Server>((resolve, reject) => {
    const candidate = app.listen(0, '127.0.0.1', (error?: Error) =>
      error ? reject(error) : resolve(candidate)
    );
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste indisponível.');
  return `http://127.0.0.1:${address.port}`;
}

function limitedApp(configure: (app: Express) => void): Express {
  const app = express();
  configure(app);
  app.get('/limited', createIpRateLimiter({ windowMs: 60_000, max: 1, message: 'Bloqueado.' }), (_request, response) => response.status(204).end());
  app.use(errorHandler);
  return app;
}

const withHops = (hops: number) => limitedApp((app) => configureTrustProxy(app, hops));

async function status(baseUrl: string, headers: Record<string, string>): Promise<number> {
  return (await fetch(`${baseUrl}/limited`, { headers })).status;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe('D03 — chave de rate limit atrás de Cloudflare + balanceador (duas camadas)', () => {
  it('R1 (reproduz a falha): com 1 salto confiável, visitantes distintos pela mesma borda compartilham o limite', async () => {
    const url = await listen(withHops(1));

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_2, EDGE_A))).toBe(429);
  });

  it('R2 (reproduz a falha): com 1 salto, o mesmo visitante em bordas distintas ganha limites independentes', async () => {
    const url = await listen(withHops(1));

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_1, EDGE_B))).toBe(204);
  });

  it('T1: com 2 saltos, visitantes distintos têm limites independentes mesmo pela mesma borda', async () => {
    const url = await listen(withHops(2));

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_2, EDGE_A))).toBe(204);
  });

  it('T2: com 2 saltos, o mesmo visitante em outra borda continua no mesmo limite', async () => {
    const url = await listen(withHops(2));

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_1, EDGE_B))).toBe(429);
  });

  it('T3: com 2 saltos, prefixos forjados de X-Forwarded-For não criam novas identidades', async () => {
    const url = await listen(withHops(2));

    expect(await status(url, chain(FORGED_1, VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(FORGED_2, VISITOR_1, EDGE_A))).toBe(429);
    expect(await status(url, chain(FORGED_1, FORGED_2, VISITOR_1, EDGE_B))).toBe(429);
  });

  it('T4 (risco): com 2 saltos, a premissa falha se o pedido chega SEM o Cloudflare — o valor forjado vira a identidade', async () => {
    const url = await listen(withHops(2));

    // Caminho com um salto a menos: [forjado, visitante real] — a posição "penúltima" é o forjado.
    expect(await status(url, chain(FORGED_1, VISITOR_1))).toBe(204);
    expect(await status(url, chain(FORGED_2, VISITOR_1))).toBe(204);
    expect(await status(url, chain(FORGED_1, VISITOR_1))).toBe(429);
  });
});

describe('D03 — alternativa por lista de proxies confiáveis (documentação executável; não usada pela aplicação)', () => {
  const CLOUDFLARE_RANGES = ['172.64.0.0/13', '104.16.0.0/13'];
  const trustListApp = () => limitedApp((app) => {
    // 'loopback' representa aqui o balanceador do Render (socket do app).
    app.set('trust proxy', ['loopback', ...CLOUDFLARE_RANGES]);
  });

  it('T5: isola visitantes e ignora prefixos forjados sem depender da contagem de saltos', async () => {
    const url = await listen(trustListApp());

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_2, EDGE_A))).toBe(204);
    expect(await status(url, chain(FORGED_1, VISITOR_1, EDGE_A))).toBe(429);
    expect(await status(url, chain(VISITOR_1, EDGE_B))).toBe(429);
  });

  it('T6: resiste ao caminho sem Cloudflare — o último não confiável é o visitante, não o valor forjado', async () => {
    const url = await listen(trustListApp());

    expect(await status(url, chain(FORGED_1, VISITOR_1))).toBe(204);
    expect(await status(url, chain(FORGED_2, VISITOR_1))).toBe(429);
  });

  it('T7: um salto extra confiável (por exemplo, outro proxy privado) não desloca a identidade', async () => {
    const url = await listen(limitedApp((app) => {
      app.set('trust proxy', ['loopback', 'uniquelocal', ...CLOUDFLARE_RANGES]);
    }));

    expect(await status(url, chain(VISITOR_1, EDGE_A, '10.1.2.3'))).toBe(204);
    expect(await status(url, chain(VISITOR_1, EDGE_B))).toBe(429);
  });
});
