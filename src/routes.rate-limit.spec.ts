import express, { type Request, type Response } from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './middlewares/error-handler.js';
import { configureTrustProxy } from './config/trust-proxy.js';

const controllerHandles = vi.hoisted(() => ({
  login: vi.fn((_request: Request, response: Response) => response.status(200).json({ status: 'success' })),
  registerUser: vi.fn((_request: Request, response: Response) => response.status(201).json({ status: 'success' })),
}));

vi.mock('./controllers/login.controller.js', () => ({ LoginController: class { handle = controllerHandles.login; } }));
vi.mock('./controllers/register-user.controller.js', () => ({ RegisterUserController: class { handle = controllerHandles.registerUser; } }));
vi.mock('./controllers/create-company.controller.js', () => ({ CreateCompanyController: class { handle = vi.fn(); } }));
vi.mock('./controllers/list-products.controller.js', () => ({ ListProductsController: class { handle = vi.fn(); } }));
vi.mock('./controllers/upload-invoice.controller.js', () => ({ UploadInvoiceController: class { handle = vi.fn(); } }));
vi.mock('./middlewares/ensure-authenticated.js', () => ({ createEnsureAuthenticated: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('./middlewares/upload-rate-limiter.js', () => ({ uploadRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('./config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/docscan-test', JWT_SECRET: 'test', GEMINI_API_KEY: 'test', PORT: 3333,
    TRUST_PROXY_HOPS: 0,
    SIMILARITY_CONFIDENCE_THRESHOLD: 0.7,
  },
}));

const { routes } = await import('./routes.js');

describe('rate limiting HTTP de autenticação', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    configureTrustProxy(app, 1);
    app.use(express.json());
    app.use(routes);
    app.use(errorHandler);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor de teste indisponível.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => vi.clearAllMocks());

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function post(path: string, ip: string) {
    const body = path === '/users'
      ? { email: 'user@test.local', password: 'password', name: 'User' }
      : { email: 'user@test.local', password: 'password' };
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    });
  }

  it('permite dez logins e bloqueia o décimo primeiro sem executar o controller', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await post('/login', '198.51.100.20')).status).toBe(200);
    }
    const blocked = await post('/login', '198.51.100.20');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(controllerHandles.login).toHaveBeenCalledTimes(10);
  });

  it('permite cinco cadastros e bloqueia o sexto sem executar o controller', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await post('/users', '198.51.100.30')).status).toBe(201);
    }
    const blocked = await post('/users', '198.51.100.30');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(controllerHandles.registerUser).toHaveBeenCalledTimes(5);
  });

  it('não compartilha contador de login entre IPs distintos', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) await post('/login', '198.51.100.40');
    expect((await post('/login', '198.51.100.41')).status).toBe(200);
  });
});
