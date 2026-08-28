import express from 'express';
import { unlink } from 'node:fs/promises';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { createRoutes } from './routes.js';
import { RegisterUserController } from './controllers/register-user.controller.js';
import { LoginController } from './controllers/login.controller.js';
import { CreateCompanyController } from './controllers/create-company.controller.js';
import { ListProductsController } from './controllers/list-products.controller.js';
import { ListCompaniesController } from './controllers/list-companies.controller.js';
import { ListCompanyStocksController } from './controllers/list-company-stocks.controller.js';
import { UploadInvoiceController } from './controllers/upload-invoice.controller.js';
import {
  ConfirmProductSuggestionController,
  RejectProductSuggestionController,
  ListPendingProductSuggestionsController,
} from './controllers/product-suggestion.controllers.js';
import { ChangePasswordController } from './controllers/change-password.controller.js';
import { invoiceUpload } from './middlewares/invoice-upload.js';
import { AppError } from './errors/app-error.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stockId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const suggestionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const companyId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const pass = (request: express.Request, _response: express.Response, next: express.NextFunction) => {
  request.user = { id: userId };
  next();
};

describe('HTTP route matrix with injected use cases', () => {
  let server: Server;
  let baseUrl: string;
  const registerUser = vi.fn();
  const login = vi.fn();
  const createCompany = vi.fn();
  const listCompanies = vi.fn();
  const listCompanyStocks = vi.fn();
  const listProducts = vi.fn();
  const readInvoice = vi.fn();
  const confirmSuggestion = vi.fn();
  const rejectSuggestion = vi.fn();
  const listSuggestions = vi.fn();
  const changePassword = vi.fn();
  const deleteFile = vi.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const applicationRoutes = createRoutes({
      authenticate: pass,
      uploadRateLimiter: pass,
      loginRateLimiter: pass,
      userRegistrationRateLimiter: pass,
      changePasswordRateLimiter: pass,
      invoiceUpload: invoiceUpload.single('file'),
      controllers: {
        registerUser: new RegisterUserController({ execute: registerUser } as never),
        login: new LoginController({ execute: login } as never),
        createCompany: new CreateCompanyController({ execute: createCompany } as never),
        listCompanies: new ListCompaniesController({ execute: listCompanies } as never),
        listCompanyStocks: new ListCompanyStocksController({ execute: listCompanyStocks } as never),
        listProducts: new ListProductsController({ execute: listProducts } as never),
        uploadInvoice: new UploadInvoiceController({ execute: readInvoice } as never, { readFile: vi.fn(), deleteFile }),
        confirmSuggestion: new ConfirmProductSuggestionController({ execute: confirmSuggestion } as never),
        rejectSuggestion: new RejectProductSuggestionController({ execute: rejectSuggestion } as never),
        listSuggestions: new ListPendingProductSuggestionsController({ execute: listSuggestions } as never),
        changePassword: new ChangePasswordController({ execute: changePassword } as never),
      },
    });
    const app = createApp({ applicationRoutes, healthProbe: vi.fn().mockResolvedValue(undefined), logger });
    server = await new Promise<Server>((resolve, reject) => {
      const candidate = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve(candidate));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor indisponível');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    registerUser.mockResolvedValue({ id: userId, name: 'User', email: 'user@test.local' });
    login.mockResolvedValue({ token: 'jwt-token' });
    createCompany.mockResolvedValue({ company: { id: 'company-1' }, defaultStock: { id: stockId } });
    listCompanies.mockResolvedValue({ items: [{ id: 'company-1', name: 'Empresa', cnpj: '11222333000181', createdAt: new Date('2026-01-01'), role: 'OWNER' }], nextCursor: null });
    listCompanyStocks.mockResolvedValue({ items: [{ id: stockId, name: 'Estoque Principal', createdAt: new Date('2026-01-01') }], nextCursor: null });
    listProducts.mockResolvedValue({ items: [{ id: 'product-1' }], nextCursor: 'next-product' });
    readInvoice.mockImplementation(async ({ filePath }) => {
      await unlink(filePath);
      return { extractedData: { accessKey: '1'.repeat(44) }, processedProducts: [], suggestions: [] };
    });
    confirmSuggestion.mockResolvedValue({ id: suggestionId, status: 'CONFIRMED' });
    rejectSuggestion.mockResolvedValue({ id: suggestionId, status: 'REJECTED' });
    listSuggestions.mockResolvedValue([{ id: suggestionId, status: 'PENDING' }]);
    changePassword.mockResolvedValue(undefined);
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const jsonPost = (path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const jsonPatch = (path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  it('POST /users é público, valida, encaminha body ao use case e devolve o envelope padrão', async () => {
    const response = await jsonPost('/users', { name: 'User Name', email: 'USER@Test.Local', password: 'password123' });
    expect(response.status).toBe(201);
    expect(registerUser).toHaveBeenCalledWith({ name: 'User Name', email: 'user@test.local', password: 'password123' });
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      data: { id: userId, name: 'User', email: 'user@test.local' },
    });
  });

  it('POST /users traduz conflito de e-mail duplicado do use case para 409 via AppError (regressão M6-01)', async () => {
    registerUser.mockRejectedValueOnce(new AppError('Já existe um usuário cadastrado com este email.', 409));
    const response = await jsonPost('/users', { name: 'User Name', email: 'dup@test.local', password: 'password123' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      message: 'Já existe um usuário cadastrado com este email.',
    });
  });

  it('POST /login é público e devolve o envelope padrão', async () => {
    const response = await jsonPost('/login', { email: 'user@test.local', password: 'password123' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'success', data: { token: 'jwt-token' } });
    expect(login).toHaveBeenCalledOnce();
  });

  it('POST /login traduz credenciais inválidas do use case para 401 via AppError', async () => {
    login.mockRejectedValueOnce(new AppError('E-mail ou senha inválidos.', 401));
    const response = await jsonPost('/login', { email: 'user@test.local', password: 'wrong-password' });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('POST /companies encaminha identidade confiável, body e request ID', async () => {
    const response = await fetch(`${baseUrl}/companies`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'company-request' },
      body: JSON.stringify({ name: 'Empresa', cnpj: '11.222.333/0001-81' }),
    });
    expect(response.status).toBe(201);
    expect(createCompany).toHaveBeenCalledWith({ name: 'Empresa', cnpj: '11222333000181', ownerId: userId, requestId: 'company-request' });
  });

  it('GET /companies encaminha identidade confiável e devolve envelope paginado', async () => {
    const response = await fetch(`${baseUrl}/companies`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      data: {
        items: [{ id: 'company-1', name: 'Empresa', cnpj: '11222333000181', createdAt: '2026-01-01T00:00:00.000Z', role: 'OWNER' }],
        nextCursor: null,
      },
    });
    expect(listCompanies).toHaveBeenCalledWith({ userId, limit: 50 });
  });

  it('GET /companies/:companyId/stocks encaminha identidade confiável, request ID e devolve envelope paginado', async () => {
    const response = await fetch(`${baseUrl}/companies/${companyId}/stocks`, {
      headers: { 'x-request-id': 'company-stocks-request' },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      data: {
        items: [{ id: stockId, name: 'Estoque Principal', createdAt: '2026-01-01T00:00:00.000Z' }],
        nextCursor: null,
      },
    });
    expect(listCompanyStocks).toHaveBeenCalledWith({
      userId, companyId, limit: 50, cursor: undefined, requestId: 'company-stocks-request',
    });
  });

  it('GET /products encaminha paginação e devolve envelope paginado', async () => {
    const response = await fetch(`${baseUrl}/products?stockId=${stockId}&limit=2&cursor=${suggestionId}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'success', data: { items: [{ id: 'product-1' }], nextCursor: 'next-product' },
    });
    expect(listProducts).toHaveBeenCalledWith({ userId, stockId, limit: 2, cursor: suggestionId });
  });

  it('cobre list/confirm/reject de suggestions com params e identidade confiáveis', async () => {
    expect((await fetch(`${baseUrl}/stocks/${stockId}/suggestions`)).status).toBe(200);
    expect((await jsonPost(`/suggestions/${suggestionId}/confirm`, {})).status).toBe(200);
    expect((await jsonPost(`/suggestions/${suggestionId}/reject`, {})).status).toBe(200);
    expect(listSuggestions).toHaveBeenCalledWith({ stockId, userId });
    expect(confirmSuggestion).toHaveBeenCalledWith({ suggestionId, userId });
    expect(rejectSuggestion).toHaveBeenCalledWith({ suggestionId, userId });
  });

  it('PATCH /me/password encaminha identidade confiável e devolve 204 sem corpo', async () => {
    const response = await jsonPatch('/me/password', { currentPassword: 'current-password', newPassword: 'new-password' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(changePassword).toHaveBeenCalledWith({
      userId, currentPassword: 'current-password', newPassword: 'new-password', requestId: expect.any(String),
    });
  });

  it('PATCH /me/password traduz senha atual incorreta do use case para 401 via AppError', async () => {
    changePassword.mockRejectedValueOnce(new AppError('Senha atual incorreta.', 401));
    const response = await jsonPatch('/me/password', { currentPassword: 'wrong-password', newPassword: 'new-password' });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ status: 'error', message: 'Senha atual incorreta.' });
  });

  it('POST /invoices/upload entrega multipart ao use case sem Gemini real', async () => {
    const form = new FormData();
    form.append('stockId', stockId);
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'danfe.png');
    const response = await fetch(`${baseUrl}/invoices/upload`, { method: 'POST', body: form });
    expect(response.status).toBe(201);
    expect(readInvoice).toHaveBeenCalledWith(expect.objectContaining({ stockId, userId, mimeType: 'image/png' }));
  });

  it('POST /invoices/upload rejeita arquivo ausente antes do use case', async () => {
    const form = new FormData();
    form.append('stockId', stockId);
    const response = await fetch(`${baseUrl}/invoices/upload`, { method: 'POST', body: form });
    expect(response.status).toBe(400);
    expect(readInvoice).not.toHaveBeenCalled();
  });

  it('POST /invoices/upload traduz excesso de itens por DANFE (P4-01) para 422 via AppError', async () => {
    readInvoice.mockRejectedValueOnce(new AppError('O DANFE contém mais itens do que o limite permitido (100).', 422));
    const form = new FormData();
    form.append('stockId', stockId);
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'danfe.png');
    const response = await fetch(`${baseUrl}/invoices/upload`, { method: 'POST', body: form });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      status: 'error', message: 'O DANFE contém mais itens do que o limite permitido (100).',
    });
  });

  it('prova boundaries Zod de body, query, param e command vazio antes dos use cases', async () => {
    expect((await jsonPost('/users', { name: 'X', email: 'bad', password: 'short', admin: true })).status).toBe(400);
    expect((await fetch(`${baseUrl}/products?stockId=invalid&limit=201`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/companies?limit=201`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/companies/not-uuid/stocks`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/companies/${companyId}/stocks?limit=201`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/stocks/not-uuid/suggestions`)).status).toBe(400);
    expect((await jsonPost(`/suggestions/${suggestionId}/confirm`, { productId: stockId })).status).toBe(400);
    expect((await jsonPatch('/me/password', { currentPassword: 'short', newPassword: 'new-password' })).status).toBe(400);
    expect((await jsonPatch('/me/password', { currentPassword: 'current-password' })).status).toBe(400);
    expect(registerUser).not.toHaveBeenCalled();
    expect(changePassword).not.toHaveBeenCalled();
    expect(listCompanies).not.toHaveBeenCalled();
    expect(listCompanyStocks).not.toHaveBeenCalled();
    expect(listProducts).not.toHaveBeenCalled();
    expect(listSuggestions).not.toHaveBeenCalled();
    expect(confirmSuggestion).not.toHaveBeenCalled();
  });

  it('mantém AppError, erro desconhecido, request ID e health público', async () => {
    createCompany.mockRejectedValueOnce(new AppError('Conflito conhecido', 409));
    const known = await jsonPost('/companies', { name: 'Empresa', cnpj: '11222333000181' });
    expect(known.status).toBe(409);
    expect(known.headers.get('x-request-id')).toBeTruthy();

    createCompany.mockRejectedValueOnce(new Error('secret stack detail'));
    const unknown = await jsonPost('/companies', { name: 'Empresa', cnpj: '11222333000181' });
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain('secret stack detail');

    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
  });
});
