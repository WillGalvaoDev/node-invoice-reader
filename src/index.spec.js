import { afterEach, describe, expect, it, vi } from 'vitest';
const infrastructure = vi.hoisted(() => ({
    disconnectPrisma: vi.fn().mockResolvedValue(undefined),
    checkDatabaseHealth: vi.fn().mockResolvedValue(undefined),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./routes.js', async () => {
    const express = await import('express');
    return { routes: express.default.Router() };
});
vi.mock('./config/env.js', () => ({
    env: {
        PORT: 0,
        REQUEST_TIMEOUT_MS: 90_000,
        SHUTDOWN_TIMEOUT_MS: 1_000,
        TRUST_PROXY_HOPS: 0,
        CORS_ALLOWED_ORIGINS: [],
    },
}));
vi.mock('./infra/prisma.js', () => ({ disconnectPrisma: infrastructure.disconnectPrisma }));
vi.mock('./infra/health.js', () => ({ checkDatabaseHealth: infrastructure.checkDatabaseHealth }));
vi.mock('./infra/logger.js', () => ({ logger: infrastructure.logger }));
describe('application bootstrap', () => {
    const initialSigtermListeners = process.listenerCount('SIGTERM');
    const initialSigintListeners = process.listenerCount('SIGINT');
    afterEach(() => vi.clearAllMocks());
    it('não inicia servidor nem instala handlers apenas por ser importado', async () => {
        await import('./index.js');
        expect(process.listenerCount('SIGTERM')).toBe(initialSigtermListeners);
        expect(process.listenerCount('SIGINT')).toBe(initialSigintListeners);
        expect(infrastructure.logger.info).not.toHaveBeenCalledWith('HTTP server started', expect.anything());
    });
    it('startApplication conecta app, timeout e handlers com cleanup removível', async () => {
        const { startApplication } = await import('./index.js');
        const beforeSigterm = process.listenerCount('SIGTERM');
        const started = startApplication();
        await new Promise((resolve) => started.server.listening ? resolve() : started.server.once('listening', resolve));
        expect(started.server.requestTimeout).toBe(90_000);
        expect(started.server.timeout).toBe(90_000);
        expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm + 1);
        started.uninstallProcessHandlers();
        await new Promise((resolve) => started.server.close(() => resolve()));
        expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm);
    });
});
//# sourceMappingURL=index.spec.js.map