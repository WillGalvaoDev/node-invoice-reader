import { type RequestHandler } from 'express';
import type { Logger } from './infra/logger.js';
export interface OperationalState {
    isShuttingDown(): boolean;
    beginShutdown(): void;
}
export declare function createOperationalState(): OperationalState;
interface CreateAppOptions {
    applicationRoutes: RequestHandler;
    healthProbe: () => Promise<void>;
    operationalState?: OperationalState;
    logger?: Logger;
    trustProxyHops?: number;
    allowedOrigins?: readonly string[];
}
export declare function createApp({ applicationRoutes, healthProbe, operationalState, logger, trustProxyHops, allowedOrigins, }: CreateAppOptions): import("express-serve-static-core").Express;
export {};
//# sourceMappingURL=app.d.ts.map