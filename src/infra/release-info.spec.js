import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { readReleaseInfo } from './release-info.js';
const SHA = '90fdfe4e6697cafecc0001bbc3c95210d481b292';
describe('readReleaseInfo', () => {
    let directory;
    afterEach(async () => {
        if (directory)
            await rm(directory, { recursive: true, force: true });
        directory = undefined;
    });
    it('usa o commit da plataforma, depois RELEASE_SHA, e "unknown" quando ausente', () => {
        expect(readReleaseInfo({ RENDER_GIT_COMMIT: SHA, RELEASE_SHA: 'abcdef1' }, undefined).api.sha).toBe(SHA);
        expect(readReleaseInfo({ RELEASE_SHA: 'abcdef1' }, undefined).api.sha).toBe('abcdef1');
        expect(readReleaseInfo({}, undefined).api.sha).toBe('unknown');
    });
    it('só aceita SHA hexadecimal curto/longo: qualquer outro conteúdo vira "unknown"', () => {
        for (const value of ['', 'main', 'postgresql://user:pw@host/db', '<script>', 'g'.repeat(40), 'a'.repeat(41), 'abc']) {
            expect(readReleaseInfo({ RENDER_GIT_COMMIT: value }, undefined).api.sha).toBe('unknown');
        }
    });
    it('lê a versão da interface do version.json do build e ignora arquivo ausente ou inválido', async () => {
        directory = await mkdtemp(join(tmpdir(), 'docscan-release-'));
        expect(readReleaseInfo({}, directory).web).toBeNull();
        await writeFile(join(directory, 'version.json'), JSON.stringify({ sha: SHA, secret: 'x' }));
        expect(readReleaseInfo({}, directory).web).toEqual({ sha: SHA });
        await writeFile(join(directory, 'version.json'), '{nao-json');
        expect(readReleaseInfo({}, directory).web).toBeNull();
        await writeFile(join(directory, 'version.json'), JSON.stringify({ sha: 'DATABASE_URL=postgres://x' }));
        expect(readReleaseInfo({}, directory).web).toBeNull();
    });
    it('expõe somente api.sha e web.sha, sem nenhuma configuração do ambiente', () => {
        const info = readReleaseInfo({
            RENDER_GIT_COMMIT: SHA, JWT_SECRET: 'segredo', DATABASE_URL: 'postgresql://x', GEMINI_API_KEY: 'k',
        }, undefined);
        expect(JSON.stringify(info)).not.toMatch(/segredo|postgresql|GEMINI|JWT/);
        expect(Object.keys(info).sort()).toEqual(['api', 'web']);
        expect(Object.keys(info.api)).toEqual(['sha']);
    });
});
describe('GET /version', () => {
    let server;
    afterEach(async () => {
        await new Promise((resolve) => server.close(() => resolve()));
    });
    it('é público, devolve a release no envelope e não executa a sonda do banco', async () => {
        const probe = vi.fn().mockResolvedValue(undefined);
        const app = createApp({
            applicationRoutes: express.Router(),
            healthProbe: probe,
            logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            releaseInfo: { api: { sha: SHA }, web: { sha: SHA } },
        });
        const baseUrl = await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                const address = server.address();
                resolve(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`);
            });
        });
        const response = await fetch(`${baseUrl}/version`);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({ status: 'success', data: { api: { sha: SHA }, web: { sha: SHA } } });
        expect(probe).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=release-info.spec.js.map