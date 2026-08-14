import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '../infra/logger.js';
import { requestIdMiddleware } from './request-id.js';
import { createErrorHandler } from './error-handler.js';
import { createIpRateLimiter } from './auth-rate-limiters.js';
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
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    })));
});
describe('request ID HTTP', () => {
    it('gera UUID válido, devolve X-Request-Id e preserva resposta normal', async () => {
        const app = express();
        app.use(requestIdMiddleware);
        app.get('/success', (_request, response) => response.status(200).json({ status: 'success' }));
        const baseUrl = await listen(app);
        const response = await fetch(`${baseUrl}/success`);
        const requestId = response.headers.get('x-request-id');
        expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(requestId?.length).toBe(36);
        await expect(response.json()).resolves.toEqual({ status: 'success' });
    });
    it('aceita ID externo válido e substitui valores inválidos ou grandes', async () => {
        const app = express();
        app.use(requestIdMiddleware);
        app.get('/', (_request, response) => response.status(204).end());
        const baseUrl = await listen(app);
        const accepted = await fetch(baseUrl, { headers: { 'x-request-id': 'client-request_123' } });
        expect(accepted.headers.get('x-request-id')).toBe('client-request_123');
        for (const invalid of ['contains spaces', 'x'.repeat(65), '<script>']) {
            const response = await fetch(baseUrl, { headers: { 'x-request-id': invalid } });
            expect(response.headers.get('x-request-id')).not.toBe(invalid);
            expect(response.headers.get('x-request-id')).toHaveLength(36);
        }
    });
    it('disponibiliza o mesmo ID ao error handler/logger sem expor erro sensível na resposta', async () => {
        const entries = [];
        const logger = createLogger({ sink: (entry) => entries.push(entry) });
        const app = express();
        app.use(requestIdMiddleware);
        app.get('/error', (_request, _response, next) => next(new Error('internal-password-value')));
        app.use(createErrorHandler(logger));
        const baseUrl = await listen(app);
        const response = await fetch(`${baseUrl}/error`, { headers: { 'x-request-id': 'error-request-1' } });
        expect(response.status).toBe(500);
        expect(response.headers.get('x-request-id')).toBe('error-request-1');
        await expect(response.json()).resolves.toEqual({ status: 'error', message: 'Internal server error' });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ level: 'error', requestId: 'error-request-1', context: { error: { name: 'Error' } } });
        expect(JSON.stringify(entries)).not.toContain('internal-password-value');
    });
    it('mantém request ID na resposta 429 do M2-01', async () => {
        const app = express();
        app.use(requestIdMiddleware);
        app.get('/limited', createIpRateLimiter({ windowMs: 60_000, max: 1, message: 'Bloqueado.' }), (_req, res) => res.status(204).end());
        app.use(createErrorHandler(createLogger({ sink: () => undefined })));
        const baseUrl = await listen(app);
        expect((await fetch(`${baseUrl}/limited`, { headers: { 'x-request-id': 'rate-1' } })).status).toBe(204);
        const blocked = await fetch(`${baseUrl}/limited`, { headers: { 'x-request-id': 'rate-2' } });
        expect(blocked.status).toBe(429);
        expect(blocked.headers.get('x-request-id')).toBe('rate-2');
    });
});
//# sourceMappingURL=request-id.spec.js.map