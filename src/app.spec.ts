import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, createOperationalState } from './app.js';

const logger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const openServers: Server[] = [];

async function listen(app: ReturnType<typeof createApp>): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) return reject(error);
      openServers.push(server);
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Endereço inválido'));
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('operational health endpoint', () => {
  it('é público, consulta a dependência real injetada e responde minimamente com request ID', async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ applicationRoutes: express.Router(), healthProbe: probe, logger: logger() });
    const response = await fetch(`${await listen(app)}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(probe).toHaveBeenCalledOnce();
  });

  it('retorna 503 sem vazar erro interno quando o banco está indisponível', async () => {
    const applicationLogger = logger();
    const app = createApp({
      applicationRoutes: express.Router(),
      healthProbe: vi.fn().mockRejectedValue(new Error('postgresql://secret-host/internal')),
      logger: applicationLogger,
    });
    const response = await fetch(`${await listen(app)}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(applicationLogger.warn.mock.calls)).not.toContain('secret-host');
  });

  it('fica indisponível durante shutdown sem consultar o banco', async () => {
    const state = createOperationalState();
    state.beginShutdown();
    const probe = vi.fn();
    const app = createApp({ applicationRoutes: express.Router(), healthProbe: probe, operationalState: state, logger: logger() });
    const response = await fetch(`${await listen(app)}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(probe).not.toHaveBeenCalled();
  });

  it('preserva uma resposta JSON normal', async () => {
    const router = express.Router().get('/normal', (_request, response) => response.json({ value: 1 }));
    const response = await fetch(`${await listen(createApp({ applicationRoutes: router, healthProbe: vi.fn(), logger: logger() }))}/normal`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 1 });
  });
});
