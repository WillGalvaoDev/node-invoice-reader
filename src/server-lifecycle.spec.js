import express from 'express';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpServer, createServerLifecycle, installProcessHandlers, } from './server-lifecycle.js';
import { createOperationalState } from './app.js';
const logger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
afterEach(() => vi.useRealTimers());
describe('HTTP server lifecycle', () => {
    it('configura timeout explícito sem alterar headers/keep-alive', () => {
        const server = createHttpServer(express(), 120_000);
        expect(server.requestTimeout).toBe(120_000);
        expect(server.timeout).toBe(120_000);
        expect(server.headersTimeout).toBe(60_000);
        expect(server.keepAliveTimeout).toBe(5_000);
        server.close();
    });
    it('drena request em voo antes de fechar o banco e sair com zero', async () => {
        let release;
        let markStarted;
        const started = new Promise((resolve) => { markStarted = resolve; });
        const barrier = new Promise((resolve) => { release = resolve; });
        const events = [];
        const app = express().get('/slow', async (_request, response) => {
            markStarted();
            await barrier;
            events.push('request-finished');
            response.json({ ok: true });
        });
        const server = createHttpServer(app, 5_000);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('Endereço inválido');
        const request = fetch(`http://127.0.0.1:${address.port}/slow`, { headers: { Connection: 'close' } });
        await started;
        const exit = vi.fn();
        const closeDatabase = vi.fn(async () => { events.push('database-closed'); });
        const lifecycle = createServerLifecycle({
            server, operationalState: createOperationalState(), closeDatabase,
            logger: logger(), shutdownTimeoutMs: 1_000, exit,
        });
        const shutdown = lifecycle.shutdown('SIGTERM', 0);
        await expect(fetch(`http://127.0.0.1:${address.port}/slow`)).rejects.toThrow();
        release();
        expect((await request).status).toBe(200);
        await shutdown;
        expect(events).toEqual(['request-finished', 'database-closed']);
        expect(exit).toHaveBeenCalledWith(0);
        expect(closeDatabase).toHaveBeenCalledOnce();
    });
    it('é idempotente e executa cleanup apenas uma vez', async () => {
        const fakeServer = { close: vi.fn((callback) => callback()) };
        const closeDatabase = vi.fn().mockResolvedValue(undefined);
        const exit = vi.fn();
        const lifecycle = createServerLifecycle({
            server: fakeServer, operationalState: createOperationalState(), closeDatabase,
            logger: logger(), shutdownTimeoutMs: 1_000, exit,
        });
        await Promise.all([lifecycle.shutdown('SIGTERM', 0), lifecycle.shutdown('SIGINT', 0)]);
        expect(fakeServer.close).toHaveBeenCalledOnce();
        expect(closeDatabase).toHaveBeenCalledOnce();
        expect(exit).toHaveBeenCalledOnce();
    });
    it('força conexões no deadline, fecha banco e sai com código não-zero', async () => {
        vi.useFakeTimers();
        const fakeServer = {
            close: vi.fn(),
            closeAllConnections: vi.fn(),
        };
        const applicationLogger = logger();
        const closeDatabase = vi.fn().mockResolvedValue(undefined);
        const exit = vi.fn();
        const lifecycle = createServerLifecycle({
            server: fakeServer, operationalState: createOperationalState(), closeDatabase,
            logger: applicationLogger, shutdownTimeoutMs: 100, exit,
        });
        const shutdown = lifecycle.shutdown('SIGTERM', 0);
        await vi.advanceTimersByTimeAsync(100);
        await shutdown;
        expect(fakeServer.closeAllConnections).toHaveBeenCalledOnce();
        expect(closeDatabase).toHaveBeenCalledOnce();
        expect(applicationLogger.warn).toHaveBeenCalledWith('HTTP server shutdown timed out', { timeoutMs: 100 });
        expect(exit).toHaveBeenCalledWith(1);
    });
    it('loga falha de cleanup e termina com código não-zero', async () => {
        const applicationLogger = logger();
        const exit = vi.fn();
        const lifecycle = createServerLifecycle({
            server: { close: (callback) => callback() },
            operationalState: createOperationalState(),
            closeDatabase: vi.fn().mockRejectedValue(new Error('secret cleanup detail')),
            logger: applicationLogger, shutdownTimeoutMs: 100, exit,
        });
        await lifecycle.shutdown('SIGINT', 0);
        expect(applicationLogger.error).toHaveBeenCalledWith('Server cleanup failed', { error: { name: 'Error' } });
        expect(JSON.stringify(applicationLogger.error.mock.calls)).not.toContain('secret cleanup detail');
        expect(exit).toHaveBeenCalledWith(1);
    });
});
describe('fatal process handlers', () => {
    it.each(['SIGTERM', 'SIGINT'])('%s inicia shutdown normal', async (signal) => {
        const processEvents = new EventEmitter();
        const shutdown = vi.fn().mockResolvedValue(undefined);
        const uninstall = installProcessHandlers({ processEvents, shutdown, logger: logger() });
        processEvents.emit(signal);
        await vi.waitFor(() => expect(shutdown).toHaveBeenCalledWith(signal, 0));
        uninstall();
        expect(processEvents.listenerCount(signal)).toBe(0);
    });
    it.each(['unhandledRejection', 'uncaughtException'])('%s é logado com segurança e encerra com código 1', async (event) => {
        const processEvents = new EventEmitter();
        const shutdown = vi.fn().mockResolvedValue(undefined);
        const applicationLogger = logger();
        const uninstall = installProcessHandlers({ processEvents, shutdown, logger: applicationLogger });
        processEvents.emit(event, new Error('token=secret-value'));
        await vi.waitFor(() => expect(shutdown).toHaveBeenCalledWith(event, 1));
        expect(applicationLogger.error).toHaveBeenCalledWith('Fatal process error', {
            event, error: { name: 'Error' },
        });
        expect(JSON.stringify(applicationLogger.error.mock.calls)).not.toContain('secret-value');
        uninstall();
    });
    it('normaliza rejection não-Error sem serializar o valor arbitrário', async () => {
        const processEvents = new EventEmitter();
        const shutdown = vi.fn().mockResolvedValue(undefined);
        const applicationLogger = logger();
        const uninstall = installProcessHandlers({ processEvents, shutdown, logger: applicationLogger });
        processEvents.emit('unhandledRejection', { authorization: 'Bearer secret' });
        await vi.waitFor(() => expect(shutdown).toHaveBeenCalled());
        expect(applicationLogger.error).toHaveBeenCalledWith('Fatal process error', {
            event: 'unhandledRejection', error: { type: 'object' },
        });
        uninstall();
    });
});
//# sourceMappingURL=server-lifecycle.spec.js.map