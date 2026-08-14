import express, {} from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './error-handler.js';
import { createIpRateLimiter } from './auth-rate-limiters.js';
import { uploadRateLimiter } from './upload-rate-limiter.js';
import { configureTrustProxy } from '../config/trust-proxy.js';
const servers = [];
async function listen(app) {
    const server = await new Promise((resolve, reject) => {
        const candidate = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve(candidate));
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Servidor de teste indisponível.');
    return `http://127.0.0.1:${address.port}`;
}
function appWith(limiter, trustProxyHops = 0) {
    const app = express();
    configureTrustProxy(app, trustProxyHops);
    app.get('/limited', limiter, (_request, response) => response.status(204).end());
    app.use(errorHandler);
    return app;
}
afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    })));
});
describe('rate limiting por IP e trust proxy', () => {
    it('mantém requisições legítimas abaixo do limite e retorna 429 previsível com Retry-After', async () => {
        const limiter = createIpRateLimiter({ windowMs: 60_000, max: 2, message: 'Limite de teste atingido.' });
        const baseUrl = await listen(appWith(limiter));
        expect((await fetch(`${baseUrl}/limited`)).status).toBe(204);
        expect((await fetch(`${baseUrl}/limited`)).status).toBe(204);
        const blocked = await fetch(`${baseUrl}/limited`);
        expect(blocked.status).toBe(429);
        expect(blocked.headers.get('retry-after')).toBeTruthy();
        await expect(blocked.json()).resolves.toEqual({ status: 'error', message: 'Limite de teste atingido.' });
    });
    it('abre uma nova janela sem sleep real', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-08-13T12:00:00Z'));
        const limiter = createIpRateLimiter({ windowMs: 1_000, max: 1, message: 'Limite de teste atingido.' });
        const baseUrl = await listen(appWith(limiter));
        expect((await fetch(`${baseUrl}/limited`)).status).toBe(204);
        expect((await fetch(`${baseUrl}/limited`)).status).toBe(429);
        vi.setSystemTime(new Date('2026-08-13T12:00:01.001Z'));
        expect((await fetch(`${baseUrl}/limited`)).status).toBe(204);
    });
    it('separa clientes por X-Forwarded-For somente quando um proxy é confiável', async () => {
        const trustedUrl = await listen(appWith(createIpRateLimiter({ windowMs: 60_000, max: 1, message: 'Bloqueado.' }), 1));
        expect((await fetch(`${trustedUrl}/limited`, { headers: { 'x-forwarded-for': '198.51.100.10' } })).status).toBe(204);
        expect((await fetch(`${trustedUrl}/limited`, { headers: { 'x-forwarded-for': '198.51.100.11' } })).status).toBe(204);
        const untrustedUrl = await listen(appWith(createIpRateLimiter({ windowMs: 60_000, max: 1, message: 'Bloqueado.' }), 0));
        expect((await fetch(`${untrustedUrl}/limited`, { headers: { 'x-forwarded-for': '198.51.100.10' } })).status).toBe(204);
        expect((await fetch(`${untrustedUrl}/limited`, { headers: { 'x-forwarded-for': '198.51.100.11' } })).status).toBe(429);
    });
    it('preserva o limite de upload e não chama o controller após a sexta requisição', async () => {
        const controller = vi.fn((_request, response) => response.status(204).end());
        const app = express();
        const stableUser = (request, _response, next) => { request.user = { id: 'upload-user' }; next(); };
        app.get('/upload', stableUser, uploadRateLimiter, controller);
        app.use(errorHandler);
        const baseUrl = await listen(app);
        for (let attempt = 0; attempt < 5; attempt += 1) {
            expect((await fetch(`${baseUrl}/upload`)).status).toBe(204);
        }
        const blocked = await fetch(`${baseUrl}/upload`);
        expect(blocked.status).toBe(429);
        expect(controller).toHaveBeenCalledTimes(5);
    });
});
//# sourceMappingURL=auth-rate-limiters.spec.js.map