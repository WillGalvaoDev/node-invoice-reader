import express, {} from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './middlewares/error-handler.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
const handles = vi.hoisted(() => ({
    login: vi.fn((request, response) => response.status(200).json({ received: request.body })),
    registerUser: vi.fn((request, response) => response.status(201).json({ received: request.body })),
    createCompany: vi.fn((request, response) => response.status(201).json({ received: request.body })),
    listProducts: vi.fn((request, response) => response.status(200).json({ received: request.query })),
}));
vi.mock('./controllers/login.controller.js', () => ({ LoginController: class {
        handle = handles.login;
    } }));
vi.mock('./controllers/register-user.controller.js', () => ({ RegisterUserController: class {
        handle = handles.registerUser;
    } }));
vi.mock('./controllers/create-company.controller.js', () => ({ CreateCompanyController: class {
        handle = handles.createCompany;
    } }));
vi.mock('./controllers/list-products.controller.js', () => ({ ListProductsController: class {
        handle = handles.listProducts;
    } }));
vi.mock('./controllers/upload-invoice.controller.js', () => ({ UploadInvoiceController: class {
        handle = vi.fn();
    } }));
vi.mock('./middlewares/ensure-authenticated.js', () => ({
    ensureAuthenticated: (request, _response, next) => {
        request.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
        next();
    },
}));
vi.mock('./middlewares/upload-rate-limiter.js', () => ({ uploadRateLimiter: (_req, _res, next) => next() }));
vi.mock('./middlewares/auth-rate-limiters.js', () => ({
    loginRateLimiter: (_req, _res, next) => next(),
    userRegistrationRateLimiter: (_req, _res, next) => next(),
}));
vi.mock('./config/env.js', () => ({
    env: { DATABASE_URL: 'postgresql://localhost/test', JWT_SECRET: 'test', GEMINI_API_KEY: 'test', PORT: 3333, TRUST_PROXY_HOPS: 0 },
}));
const { routes } = await import('./routes.js');
describe('validação declarativa HTTP', () => {
    let server;
    let baseUrl;
    beforeAll(async () => {
        const app = express();
        app.use(requestIdMiddleware);
        app.use(express.json());
        app.use(routes);
        app.use(errorHandler);
        await new Promise((resolve, reject) => {
            server = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve());
        });
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('Servidor de teste indisponível.');
        baseUrl = `http://127.0.0.1:${address.port}`;
    });
    beforeEach(() => vi.clearAllMocks());
    afterAll(async () => {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });
    async function post(path, body) {
        return fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-request-id': 'validation-request' },
            body: JSON.stringify(body),
        });
    }
    it('preserva login válido e entrega dados normalizados', async () => {
        const response = await post('/login', { email: '  USER@Example.COM ', password: 'password123' });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ received: { email: 'user@example.com', password: 'password123' } });
        expect(handles.login).toHaveBeenCalledOnce();
    });
    it.each([
        [{ password: 'password123' }, 'campo obrigatório ausente'],
        [{ email: 123, password: 'password123' }, 'tipo incorreto'],
        [{ email: 'invalid-email', password: 'password123' }, 'email inválido'],
        [{ email: 'user@example.com', password: 'short' }, 'senha curta'],
        [{ email: 'user@example.com', password: 'password123', token: 'must-not-reflect' }, 'campo inesperado'],
    ])('rejeita login inválido (%s) antes do controller', async (body, _case) => {
        const response = await post('/login', body);
        const serialized = JSON.stringify(await response.json());
        expect(response.status).toBe(400);
        expect(response.headers.get('x-request-id')).toBe('validation-request');
        expect(serialized).toContain('Dados inválidos');
        expect(serialized).not.toContain('password123');
        expect(serialized).not.toContain('must-not-reflect');
        expect(handles.login).not.toHaveBeenCalled();
    });
    it('rejeita cadastro inválido e campo inesperado antes do controller', async () => {
        const response = await post('/users', { name: 'A', email: 'not-an-email', password: '1', role: 'admin' });
        expect(response.status).toBe(400);
        expect(handles.registerUser).not.toHaveBeenCalled();
    });
    it('rejeita company inválida antes do controller', async () => {
        const response = await post('/companies', { name: 123, cnpj: { value: '123' } });
        expect(response.status).toBe(400);
        expect(handles.createCompany).not.toHaveBeenCalled();
    });
    it('canonicaliza CNPJ numérico/alfanumérico e rejeita DV inválido antes do controller', async () => {
        const numeric = await post('/companies', { name: 'Empresa Numérica', cnpj: '11.222.333/0001-81' });
        expect(numeric.status).toBe(201);
        await expect(numeric.json()).resolves.toEqual({ received: { name: 'Empresa Numérica', cnpj: '11222333000181' } });
        const alphanumeric = await post('/companies', { name: 'Empresa Alfa', cnpj: ' 12.abc.345/01de-35 ' });
        expect(alphanumeric.status).toBe(201);
        await expect(alphanumeric.json()).resolves.toEqual({ received: { name: 'Empresa Alfa', cnpj: '12ABC34501DE35' } });
        const invalid = await post('/companies', { name: 'Empresa Inválida', cnpj: '12.ABC.345/01DE-34' });
        expect(invalid.status).toBe(400);
        expect(handles.createCompany).toHaveBeenCalledTimes(2);
    });
    it('rejeita query inválida/inesperada e aceita UUIDs válidos', async () => {
        const invalid = await fetch(`${baseUrl}/products?stockId=not-a-uuid&admin=true`);
        expect(invalid.status).toBe(400);
        expect(handles.listProducts).not.toHaveBeenCalled();
        const valid = await fetch(`${baseUrl}/products?stockId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
        expect(valid.status).toBe(200);
        expect(handles.listProducts).toHaveBeenCalledOnce();
    });
    it('exige stockId, aplica limit default e valida limit/cursor', async () => {
        const stockId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const cursor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        expect((await fetch(`${baseUrl}/products`)).status).toBe(400);
        expect((await fetch(`${baseUrl}/products?stockId=${stockId}&limit=0`)).status).toBe(400);
        expect((await fetch(`${baseUrl}/products?stockId=${stockId}&limit=201`)).status).toBe(400);
        expect((await fetch(`${baseUrl}/products?stockId=${stockId}&cursor=invalid`)).status).toBe(400);
        const valid = await fetch(`${baseUrl}/products?stockId=${stockId}&limit=2&cursor=${cursor}`);
        expect(valid.status).toBe(200);
        expect(handles.listProducts).toHaveBeenCalledOnce();
    });
    it('rejeita companyId porque o estoque determina o tenant', async () => {
        const stockId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const companyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        const response = await fetch(`${baseUrl}/products?stockId=${stockId}&companyId=${companyId}`);
        expect(response.status).toBe(400);
        expect(handles.listProducts).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=routes.validation.spec.js.map