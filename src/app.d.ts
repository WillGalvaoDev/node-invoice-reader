import { type RequestHandler } from 'express';
import type { Logger } from './infra/logger.js';
import { type TrustProxyMode } from './config/trust-proxy.js';
import type { ReleaseInfo } from './infra/release-info.js';
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
    /** `hops` (padrão, contagem fixa) ou `render-cloudflare` (D03). */
    trustProxyMode?: TrustProxyMode;
    allowedOrigins?: readonly string[];
    healthCacheTtlMs?: number;
    healthRateLimiter?: RequestHandler;
    /** Diretório do build da interface web; ausente ou sem index.html = interface não servida. */
    webDistDir?: string;
    /** Identificador público da release (SHA); ausente = `/version` não é registrada. */
    releaseInfo?: ReleaseInfo;
}
export declare function createApp({ applicationRoutes, healthProbe, operationalState, logger, trustProxyHops, trustProxyMode, allowedOrigins, healthCacheTtlMs, healthRateLimiter, webDistDir, releaseInfo, }: CreateAppOptions): import("express-serve-static-core").Express;
export {};
//# sourceMappingURL=app.d.ts.map