import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from './errors/app-error.js';
import { errorHandler } from './middlewares/error-handler.js';

const controllerHandles = vi.hoisted(() => ({
  createCompany: vi.fn(),
  listProducts: vi.fn(),
  login: vi.fn(),
  registerUser: vi.fn(),
  uploadInvoice: vi.fn(),
}));

vi.mock('./controllers/create-company.controller.js', () => ({
  CreateCompanyController: class {
    handle = controllerHandles.createCompany;
  },
}));
vi.mock('./controllers/list-products.controller.js', () => ({
  ListProductsController: class {
    handle = controllerHandles.listProducts;
  },
}));
vi.mock('./controllers/login.controller.js', () => ({
  LoginController: class {
    handle = controllerHandles.login;
  },
}));
vi.mock('./controllers/register-user.controller.js', () => ({
  RegisterUserController: class {
    handle = controllerHandles.registerUser;
  },
}));
vi.mock('./controllers/upload-invoice.controller.js', () => ({
  UploadInvoiceController: class {
    handle = controllerHandles.uploadInvoice;
  },
}));
vi.mock('./middlewares/ensure-authenticated.js', () => ({
  ensureAuthenticated: (_request: unknown, _response: unknown, next: () => void) => next(),
}));
vi.mock('./middlewares/upload-rate-limiter.js', () => ({
  uploadRateLimiter: (_request: unknown, _response: unknown, next: () => void) => next(),
}));
vi.mock('./config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/docscan',
    JWT_SECRET: 'jwt-secret',
    GEMINI_API_KEY: 'gemini-key',
    PORT: 3333,
  },
}));

const { routes } = await import('./routes.js');

describe('routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    const app = express();
    app.use(express.json());
    app.use(routes);
    app.use(errorHandler);

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', (error?: Error) =>
        error ? reject(error) : resolve()
      );
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Não foi possível iniciar o servidor de teste.');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('encaminha rejeição assíncrona do controller ao error handler sem unhandledRejection', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
    process.on('unhandledRejection', onUnhandledRejection);
    controllerHandles.createCompany.mockRejectedValueOnce(new AppError('CNPJ duplicado', 409));

    try {
      const response = await fetch(`${baseUrl}/companies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Empresa', cnpj: '11222333000181' }),
        signal: AbortSignal.timeout(500),
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        status: 'error',
        message: 'CNPJ duplicado',
      });
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('preserva a resposta de sucesso do controller', async () => {
    controllerHandles.createCompany.mockImplementationOnce((_request, response) =>
      response.status(201).json({ status: 'success', data: { id: 'company-1' } })
    );

    const response = await fetch(`${baseUrl}/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Empresa', cnpj: '11222333000181' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      data: { id: 'company-1' },
    });
  });
});
