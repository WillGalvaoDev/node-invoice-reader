import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
describe('hospedagem da interface web', () => {
    let server;
    let baseUrl;
    let distDir;
    async function start(webDistDir) {
        const api = express.Router();
        api.get('/companies', (_request, response) => response.json({ status: 'success', data: { items: [] } }));
        const app = createApp({
            applicationRoutes: api,
            healthProbe: async () => undefined,
            logger,
            ...(webDistDir && { webDistDir }),
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve());
        });
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('test server unavailable');
        baseUrl = `http://127.0.0.1:${address.port}`;
    }
    beforeEach(async () => {
        distDir = await mkdtemp(join(tmpdir(), 'docscan-web-'));
        await mkdir(join(distDir, 'assets'));
        await writeFile(join(distDir, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>');
        await writeFile(join(distDir, 'assets', 'app-abc123.js'), 'console.log("app");');
    });
    afterEach(async () => {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await rm(distDir, { recursive: true, force: true });
    });
    it('serve a interface em /app/ com CSP restritiva e sem cache do HTML', async () => {
        await start(distDir);
        const response = await fetch(`${baseUrl}/app/`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(response.headers.get('cache-control')).toBe('no-cache');
        const policy = response.headers.get('content-security-policy') ?? '';
        expect(policy).toContain("default-src 'self'");
        expect(policy).toContain("script-src 'self'");
        expect(policy).toContain("frame-ancestors 'none'");
        expect(policy).not.toContain('unsafe-eval');
        expect(await response.text()).toContain('<div id="root">');
    });
    it('atende deep links e refresh com o index, e redireciona / e /app para /app/', async () => {
        await start(distDir);
        const deepLink = await fetch(`${baseUrl}/app/demo/revisao`);
        expect(deepLink.status).toBe(200);
        expect(await deepLink.text()).toContain('<div id="root">');
        const root = await fetch(`${baseUrl}/`, { redirect: 'manual' });
        expect([root.status, root.headers.get('location')]).toEqual([302, '/app/']);
        const bare = await fetch(`${baseUrl}/app`, { redirect: 'manual' });
        expect([bare.status, bare.headers.get('location')]).toEqual([302, '/app/']);
    });
    it('serve assets com cache imutável e nunca devolve HTML para asset inexistente', async () => {
        await start(distDir);
        const asset = await fetch(`${baseUrl}/app/assets/app-abc123.js`);
        expect(asset.status).toBe(200);
        expect(asset.headers.get('cache-control')).toContain('immutable');
        const missing = await fetch(`${baseUrl}/app/assets/other.js`);
        expect(missing.status).toBe(404);
        expect(missing.headers.get('content-type')).toContain('application/json');
        expect(await missing.json()).toEqual({ status: 'error', message: 'Rota não encontrada.' });
    });
    it('mantém o contrato de erro da API para rotas desconhecidas e não intercepta a API', async () => {
        await start(distDir);
        const unknown = await fetch(`${baseUrl}/nao-existe`);
        expect(unknown.status).toBe(404);
        expect(unknown.headers.get('content-type')).toContain('application/json');
        expect(await unknown.json()).toEqual({ status: 'error', message: 'Rota não encontrada.' });
        const api = await fetch(`${baseUrl}/companies`);
        expect(api.status).toBe(200);
        expect(api.headers.get('content-type')).toContain('application/json');
        expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
    });
    it('não expõe a interface fora de /app e não resolve caminhos fora do diretório', async () => {
        await start(distDir);
        expect((await fetch(`${baseUrl}/index.html`)).status).toBe(404);
        const traversal = await fetch(`${baseUrl}/app/..%2f..%2fetc%2fpasswd`);
        expect([400, 404]).toContain(traversal.status);
    });
    it('sem artefato web (diretório ausente) a API segue funcionando e /app/ responde 404 JSON', async () => {
        await start(join(distDir, 'inexistente'));
        const response = await fetch(`${baseUrl}/app/`);
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ status: 'error', message: 'Rota não encontrada.' });
        expect((await fetch(`${baseUrl}/companies`)).status).toBe(200);
    });
});
//# sourceMappingURL=web-app.spec.js.map