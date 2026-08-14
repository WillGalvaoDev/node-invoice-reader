import { createServer } from 'node:http';
export function createHttpServer(app, requestTimeoutMs) {
    const server = createServer(app);
    server.requestTimeout = requestTimeoutMs;
    server.setTimeout(requestTimeoutMs);
    return server;
}
function safeErrorContext(error) {
    return error instanceof Error ? { name: error.name } : { type: typeof error };
}
export function createServerLifecycle({ server, operationalState, closeDatabase, logger, shutdownTimeoutMs, exit, }) {
    let shutdownPromise;
    const runShutdown = async (trigger, requestedExitCode) => {
        operationalState.beginShutdown();
        logger.info('Server shutdown started', { trigger });
        let exitCode = requestedExitCode;
        let timeout;
        try {
            const drained = new Promise((resolve, reject) => {
                try {
                    server.close((error) => error ? reject(error) : resolve('drained'));
                }
                catch (error) {
                    reject(error);
                }
            });
            const deadline = new Promise((resolve) => {
                timeout = setTimeout(() => resolve('timeout'), shutdownTimeoutMs);
            });
            const result = await Promise.race([drained, deadline]);
            if (result === 'timeout') {
                exitCode = 1;
                logger.warn('HTTP server shutdown timed out', { timeoutMs: shutdownTimeoutMs });
                server.closeAllConnections?.();
            }
        }
        catch (error) {
            exitCode = 1;
            logger.error('HTTP server close failed', { error: safeErrorContext(error) });
        }
        finally {
            if (timeout)
                clearTimeout(timeout);
        }
        try {
            await closeDatabase();
        }
        catch (error) {
            exitCode = 1;
            logger.error('Server cleanup failed', { error: safeErrorContext(error) });
        }
        logger.info('Server shutdown completed', { exitCode });
        exit(exitCode);
    };
    return {
        shutdown(trigger, exitCode) {
            shutdownPromise ??= runShutdown(trigger, exitCode);
            return shutdownPromise;
        },
    };
}
export function installProcessHandlers({ processEvents, shutdown, logger }) {
    const onSigterm = () => { void shutdown('SIGTERM', 0); };
    const onSigint = () => { void shutdown('SIGINT', 0); };
    const onUnhandledRejection = (reason) => {
        logger.error('Fatal process error', { event: 'unhandledRejection', error: safeErrorContext(reason) });
        void shutdown('unhandledRejection', 1);
    };
    const onUncaughtException = (error) => {
        logger.error('Fatal process error', { event: 'uncaughtException', error: safeErrorContext(error) });
        void shutdown('uncaughtException', 1);
    };
    processEvents.on('SIGTERM', onSigterm);
    processEvents.on('SIGINT', onSigint);
    processEvents.on('unhandledRejection', onUnhandledRejection);
    processEvents.on('uncaughtException', onUncaughtException);
    return () => {
        processEvents.off('SIGTERM', onSigterm);
        processEvents.off('SIGINT', onSigint);
        processEvents.off('unhandledRejection', onUnhandledRejection);
        processEvents.off('uncaughtException', onUncaughtException);
    };
}
//# sourceMappingURL=server-lifecycle.js.map