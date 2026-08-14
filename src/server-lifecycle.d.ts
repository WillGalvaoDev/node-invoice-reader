import { type Server } from 'node:http';
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
export declare function createHttpServer(app: Express, requestTimeoutMs: number): Server;
export declare function createServerLifecycle({ server, operationalState, closeDatabase, logger, shutdownTimeoutMs, exit, }: CreateLifecycleOptions): {
    shutdown(trigger: string, exitCode: number): Promise<void>;
};
export declare function installProcessHandlers({ processEvents, shutdown, logger }: InstallProcessHandlersOptions): () => void;
export {};
//# sourceMappingURL=server-lifecycle.d.ts.map