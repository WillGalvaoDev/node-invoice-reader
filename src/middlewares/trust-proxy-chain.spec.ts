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

describe('D03 — contagem de saltos atrás de Cloudflare + balanceador (comportamento preservado)', () => {
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

describe('D03 — modo render-cloudflare (confiança posicional + faixas oficiais do Cloudflare)', () => {
  const app = () => limitedApp((instance) => configureTrustProxy(instance, 0, 'render-cloudflare'));
  // O limitador agrupa IPv6 por /56 (ipKeyGenerator); os visitantes ficam em /56 distintos.
  const V6_VISITOR_1 = '2001:db8:1::1';
  const V6_VISITOR_2 = '2001:db8:2::1';
  const V6_EDGE = '2606:4700:10::1';

  it('T5: cadeia normal — visitantes distintos pela mesma borda têm limites independentes (corrige R1)', async () => {
    const url = await listen(app());

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_2, EDGE_A))).toBe(204);
  });

  it('T5b: o mesmo visitante em outra borda continua no mesmo limite (corrige R2)', async () => {
    const url = await listen(app());

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(VISITOR_1, EDGE_B))).toBe(429);
  });

  it('T5c: IPv6 — visitante e borda em IPv6 são isolados e estáveis', async () => {
    const url = await listen(app());

    expect(await status(url, chain(V6_VISITOR_1, V6_EDGE))).toBe(204);
    expect(await status(url, chain(V6_VISITOR_2, V6_EDGE))).toBe(204);
    expect(await status(url, chain(V6_VISITOR_1, EDGE_A))).toBe(429);
  });

  it('T5d: cadeia maliciosa — prefixos forjados (inclusive endereços do Cloudflare forjados) não criam identidade', async () => {
    const url = await listen(app());

    expect(await status(url, chain(VISITOR_1, EDGE_A))).toBe(204);
    expect(await status(url, chain(FORGED_1, VISITOR_1, EDGE_A))).toBe(429);
    expect(await status(url, chain('172.64.0.9', FORGED_2, VISITOR_1, EDGE_B))).toBe(429);
  });

  it('T6: cadeia incompleta (sem Cloudflare) — a identidade é o visitante, não o valor forjado (fecha T4)', async () => {
    const url = await listen(app());

    expect(await status(url, chain(FORGED_1, VISITOR_1))).toBe(204);
    expect(await status(url, chain(FORGED_2, VISITOR_1))).toBe(429);
    expect(await status(url, chain(FORGED_1, VISITOR_2))).toBe(204);
  });

  it('T6b: cadeia incompleta com endereço do Cloudflare forjado no prefixo continua sem efeito', async () => {
    const url = await listen(app());

    expect(await status(url, chain('172.64.0.9', VISITOR_1))).toBe(204);
    expect(await status(url, chain('172.65.0.9', VISITOR_1))).toBe(429);
  });

  it('T7: borda fora da lista confiável — degrada para o salto do proxy, nunca para valor forjado', async () => {
    const url = await listen(app());
    const unknownEdge = '198.51.100.7';

    expect(await status(url, chain(VISITOR_1, unknownEdge))).toBe(204);
    // Colapsa por borda (comportamento atual de 1 salto), mas o prefixo forjado não ajuda.
    expect(await status(url, chain(FORGED_1, VISITOR_2, unknownEdge))).toBe(429);
  });

  it('T7b: rede privada não é confiável — um salto privado em segunda posição é a identidade', async () => {
    const url = await listen(app());

    expect(await status(url, chain(VISITOR_1, '10.1.2.3'))).toBe(204);
    expect(await status(url, chain(VISITOR_2, '10.1.2.3'))).toBe(429);
  });

  it('T8: sem X-Forwarded-For a identidade é o socket', async () => {
    const url = await listen(app());

    expect(await status(url, {})).toBe(204);
    expect(await status(url, {})).toBe(429);
  });

  it('T9: Express 5 chama a função de confiança com (endereço, índice) começando no socket', async () => {
    const calls: Array<[string, number]> = [];
    const url = await listen(limitedApp((instance) => {
      instance.set('trust proxy', (address: string, index: number) => {
        calls.push([address, index]);
        return index < 2;
      });
    }));

    await status(url, chain(VISITOR_1, EDGE_A));

    // O Express avalia a cadeia mais de uma vez por requisição; cada avaliação começa no socket (0).
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.map(([, index]) => index).slice(0, 2)).toEqual([0, 1]);
    expect(calls[0]?.[0]).toMatch(/127\.0\.0\.1$/);
    expect(calls[1]?.[0]).toBe(EDGE_A);
  });

  it('recusa combinar o modo com uma contagem de saltos', () => {
    expect(() => configureTrustProxy(express(), 1, 'render-cloudflare')).toThrow('não pode ser combinado');
  });
});
