import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpSecurityMiddlewares } from './http-security.js';
import { requestIdMiddleware } from './request-id.js';
const servers = [];
async function listen(allowedOrigins) {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(...createHttpSecurityMiddlewares(allowedOrigins));
    app.use(express.json());
    app.get('/resource', (_request, response) => response.json({ status: 'success' }));
    app.post('/resource', (_request, response) => response.status(201).json({ status: 'success' }));
    app.post('/upload', (_request, response) => response.status(204).end());
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
describe('CORS restritivo e Helmet', () => {
    it('autoriza independentemente duas origins da allowlist sem habilitar credentials', async () => {
        const baseUrl = await listen(['https://app.example.com', 'https://admin.example.com']);
        for (const origin of ['https://app.example.com', 'https://admin.example.com']) {
            const response = await fetch(`${baseUrl}/resource`, { headers: { origin } });
            expect(response.headers.get('access-control-allow-origin')).toBe(origin);
            expect(response.headers.get('access-control-allow-credentials')).toBeNull();
            expect(response.headers.get('vary')).toContain('Origin');
        }
    });
    it('não reflete origin arbitrária e permite cliente sem Origin sem conceder CORS', async () => {
        const baseUrl = await listen(['https://app.example.com']);
        const denied = await fetch(`${baseUrl}/resource`, { headers: { origin: 'https://attacker.example' } });
        expect(denied.headers.get('access-control-allow-origin')).toBeNull();
        const serverToServer = await fetch(`${baseUrl}/resource`);
        expect(serverToServer.status).toBe(200);
        expect(serverToServer.headers.get('access-control-allow-origin')).toBeNull();
    });
    it('responde preflight permitido com métodos e headers explícitos', async () => {
        const baseUrl = await listen(['https://app.example.com']);
        const response = await fetch(`${baseUrl}/resource`, {
            method: 'OPTIONS',
            headers: {
                origin: 'https://app.example.com',
                'access-control-request-method': 'POST',
                'access-control-request-headers': 'authorization,content-type,x-request-id',
            },
        });
        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
        expect(response.headers.get('access-control-allow-methods')).toBe('GET,POST,OPTIONS');
        expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toBe('content-type,authorization,x-request-id');
        expect(response.headers.get('access-control-expose-headers')?.toLowerCase()).toBe('x-request-id,retry-after');
        expect(response.headers.get('x-request-id')).toBeTruthy();
    });
    it('não autoriza preflight de origin fora da allowlist', async () => {
        const baseUrl = await listen([]);
        const response = await fetch(`${baseUrl}/resource`, {
            method: 'OPTIONS',
            headers: { origin: 'https://attacker.example', 'access-control-request-method': 'POST' },
        });
        expect(response.status).not.toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
    it('aplica headers Helmet sem quebrar JSON, request ID ou multipart', async () => {
        const baseUrl = await listen(['https://app.example.com']);
        const jsonResponse = await fetch(`${baseUrl}/resource`, { headers: { origin: 'https://app.example.com' } });
        expect(await jsonResponse.json()).toEqual({ status: 'success' });
        expect(jsonResponse.headers.get('x-content-type-options')).toBe('nosniff');
        expect(jsonResponse.headers.get('x-frame-options')).toBe('SAMEORIGIN');
        expect(jsonResponse.headers.get('referrer-policy')).toBe('no-referrer');
        expect(jsonResponse.headers.get('x-powered-by')).toBeNull();
        expect(jsonResponse.headers.get('content-security-policy')).toBeNull();
        expect(jsonResponse.headers.get('x-request-id')).toBeTruthy();
        const form = new FormData();
        form.set('stockId', '11111111-1111-4111-8111-111111111111');
        form.set('file', new Blob(['invoice'], { type: 'application/pdf' }), 'invoice.pdf');
        const uploadResponse = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
        expect(uploadResponse.status).toBe(204);
    });
});
//# sourceMappingURL=http-security.spec.js.map