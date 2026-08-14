import { createServer, type Server } from 'node:http';
import type { Express } from 'express';
import type { Logger } from './infra/logger.js';
import type { OperationalState } from './app.js';

export interface ClosableHttpServer {
  close(callback: (error?: Error) => void): unknown;
  closeAllConnections?(): void;
}

export interface ProcessEvents {
  on(event: string, listener: (...arguments_: unknown[]) => void): unknown;
  off(event: string, listener: (...arguments_: unknown[]) => void): unknown;
  emit(event: string, ...arguments_: unknown[]): boolean;
  listenerCount(event: string): number;
}

interface CreateLifecycleOptions {
  server: ClosableHttpServer;
  operationalState: OperationalState;
  closeDatabase: () => Promise<void>;
  logger: Logger;
  shutdownTimeoutMs: number;
  exit: (code: number) => void;
}

interface InstallProcessHandlersOptions {
  processEvents: ProcessEvents;
  shutdown: (trigger: string, exitCode: number) => Promise<void>;
  logger: Logger;
}

export function createHttpServer(app: Express, requestTimeoutMs: number): Server {
  const server = createServer(app);
  server.requestTimeout = requestTimeoutMs;
  server.setTimeout(requestTimeoutMs);
  return server;
}

function safeErrorContext(error: unknown): { name: string } | { type: string } {
  return error instanceof Error ? { name: error.name } : { type: typeof error };
}

export function createServerLifecycle({
  server,
  operationalState,
  closeDatabase,
  logger,
  shutdownTimeoutMs,
  exit,
}: CreateLifecycleOptions) {
  let shutdownPromise: Promise<void> | undefined;

  const runShutdown = async (trigger: string, requestedExitCode: number): Promise<void> => {
    operationalState.beginShutdown();
    logger.info('Server shutdown started', { trigger });
    let exitCode = requestedExitCode;
    let timeout: NodeJS.Timeout | undefined;

    try {
      const drained = new Promise<'drained'>((resolve, reject) => {
        try {
          server.close((error) => error ? reject(error) : resolve('drained'));
        } catch (error) {
          reject(error);
        }
      });
      const deadline = new Promise<'timeout'>((resolve) => {
        timeout = setTimeout(() => resolve('timeout'), shutdownTimeoutMs);
      });
      const result = await Promise.race([drained, deadline]);

      if (result === 'timeout') {
        exitCode = 1;
        logger.warn('HTTP server shutdown timed out', { timeoutMs: shutdownTimeoutMs });
        server.closeAllConnections?.();
      }
    } catch (error) {
      exitCode = 1;
      logger.error('HTTP server close failed', { error: safeErrorContext(error) });
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    try {
      await closeDatabase();
    } catch (error) {
      exitCode = 1;
      logger.error('Server cleanup failed', { error: safeErrorContext(error) });
    }

    logger.info('Server shutdown completed', { exitCode });
    exit(exitCode);
  };

  return {
    shutdown(trigger: string, exitCode: number): Promise<void> {
      shutdownPromise ??= runShutdown(trigger, exitCode);
      return shutdownPromise;
    },
  };
}

export function installProcessHandlers({ processEvents, shutdown, logger }: InstallProcessHandlersOptions): () => void {
  const onSigterm = () => { void shutdown('SIGTERM', 0); };
  const onSigint = () => { void shutdown('SIGINT', 0); };
  const onUnhandledRejection = (reason: unknown) => {
    logger.error('Fatal process error', { event: 'unhandledRejection', error: safeErrorContext(reason) });
    void shutdown('unhandledRejection', 1);
  };
  const onUncaughtException = (error: unknown) => {
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
