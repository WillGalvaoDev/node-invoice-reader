import express, { type Request, type Response } from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './middlewares/error-handler.js';

const handles = vi.hoisted(() => ({ confirm: vi.fn(), reject: vi.fn(), list: vi.fn() }));
vi.mock('./controllers/product-suggestion.controllers.js', () => ({
  ConfirmProductSuggestionController: class { handle = handles.confirm; },
  RejectProductSuggestionController: class { handle = handles.reject; },
  ListPendingProductSuggestionsController: class { handle = handles.list; },
}));
vi.mock('./controllers/login.controller.js', () => ({ LoginController: class { handle = vi.fn(); } }));
vi.mock('./controllers/register-user.controller.js', () => ({ RegisterUserController: class { handle = vi.fn(); } }));
vi.mock('./controllers/create-company.controller.js', () => ({ CreateCompanyController: class { handle = vi.fn(); } }));
vi.mock('./controllers/list-products.controller.js', () => ({ ListProductsController: class { handle = vi.fn(); } }));
vi.mock('./controllers/upload-invoice.controller.js', () => ({ UploadInvoiceController: class { handle = vi.fn(); } }));
vi.mock('./middlewares/ensure-authenticated.js', () => ({
  createEnsureAuthenticated: () => (request: Request, _response: Response, next: () => void) => {
    request.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    next();
  },
}));
vi.mock('./middlewares/upload-rate-limiter.js', () => ({ uploadRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('./middlewares/auth-rate-limiters.js', () => ({
  loginRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  userRegistrationRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('./config/env.js', () => ({ env: { DATABASE_URL: 'postgresql://localhost/test', JWT_SECRET: 'test', GEMINI_API_KEY: 'test', PORT: 3333 } }));

const { routes } = await import('./routes.js');

describe('rotas de decisao de sugestao', () => {
  let server: Server;
  let baseUrl: string;
  const id = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(routes);
    app.use(errorHandler);
    server = await new Promise<Server>((resolve, reject) => {
      const candidate = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve(candidate));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor indisponivel.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handles.confirm.mockImplementation((_req: Request, res: Response) => res.status(200).json({ status: 'success' }));
    handles.reject.mockImplementation((_req: Request, res: Response) => res.status(200).json({ status: 'success' }));
    handles.list.mockImplementation((_req: Request, res: Response) => res.status(200).json({ status: 'success' }));
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  it.each(['confirm', 'reject'] as const)('aceita comando %s com ID e body vazio', async (command) => {
    const response = await fetch(`${baseUrl}/suggestions/${id}/${command}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(response.status).toBe(200);
    expect(handles[command]).toHaveBeenCalledOnce();
  });

  it('rejeita ID invalido e campos que tentem substituir dados persistidos', async () => {
    const invalidId = await fetch(`${baseUrl}/suggestions/not-a-uuid/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(invalidId.status).toBe(400);

    const massAssignment = await fetch(`${baseUrl}/suggestions/${id}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stockId: id, companyId: id, productId: id, quantity: 999 }),
    });
    expect(massAssignment.status).toBe(400);
    expect(handles.confirm).not.toHaveBeenCalled();
  });

  it('lista pending por stock UUID validado', async () => {
    expect((await fetch(`${baseUrl}/stocks/${id}/suggestions`)).status).toBe(200);
    expect(handles.list).toHaveBeenCalledOnce();
    expect((await fetch(`${baseUrl}/stocks/not-a-uuid/suggestions`)).status).toBe(400);
  });
});
