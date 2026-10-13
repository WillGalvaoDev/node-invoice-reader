import express, { type RequestHandler } from 'express';
import type { Logger } from './infra/logger.js';
import { logger as applicationLogger } from './infra/logger.js';
import { configureTrustProxy, type TrustProxyMode } from './config/trust-proxy.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { createHttpSecurityMiddlewares } from './middlewares/http-security.js';
import { createErrorHandler } from './middlewares/error-handler.js';
import { createHealthRateLimiter } from './middlewares/health-rate-limiter.js';
import { apiNotFound, createWebRouter, webArtifactExists } from './web/web-app.js';
import type { ReleaseInfo } from './infra/release-info.js';

export interface OperationalState {
  isShuttingDown(): boolean;
  beginShutdown(): void;
}

export function createOperationalState(): OperationalState {
  let shuttingDown = false;
  return {
    isShuttingDown: () => shuttingDown,
    beginShutdown: () => { shuttingDown = true; },
  };
}

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

export function createApp({
  applicationRoutes,
  healthProbe,
  operationalState = createOperationalState(),
  logger = applicationLogger,
  trustProxyHops = 0,
  trustProxyMode = 'hops',
  allowedOrigins = [],
  healthCacheTtlMs = 5_000,
  healthRateLimiter = createHealthRateLimiter(),
  webDistDir,
  releaseInfo,
}: CreateAppOptions) {
  const app = express();
  let healthyUntil = 0;
  let pendingHealthProbe: Promise<void> | undefined;

  const cachedHealthProbe = async (): Promise<void> => {
    if (Date.now() < healthyUntil) return;

    pendingHealthProbe ??= healthProbe()
      .then(() => { healthyUntil = Date.now() + healthCacheTtlMs; })
      .finally(() => { pendingHealthProbe = undefined; });
    await pendingHealthProbe;
  };

  configureTrustProxy(app, trustProxyHops, trustProxyMode);
  app.use(requestIdMiddleware);
  app.use(...createHttpSecurityMiddlewares(allowedOrigins));

  const rejectHealthDuringShutdown: RequestHandler = (_request, response, next) => {
    if (operationalState.isShuttingDown()) {
      response.status(503).json({ status: 'unavailable' });
      return;
    }
    next();
  };

  app.get('/health', rejectHealthDuringShutdown, healthRateLimiter, async (_request, response) => {
    try {
      await cachedHealthProbe();
      return response.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.warn('Database health check failed', {
        error: { name: error instanceof Error ? error.name : 'UnknownError' },
      });
      return response.status(503).json({ status: 'unavailable' });
    }
  });

  if (releaseInfo) {
    // Sem consulta ao banco e sem configuração: apenas o SHA, para provar qual release atende.
    app.get('/version', healthRateLimiter, (_request, response) => {
      response.set('Cache-Control', 'no-store');
      return response.status(200).json({ status: 'success', data: releaseInfo });
    });
  }

  app.use(express.json());
  app.use(applicationRoutes);
  if (webDistDir && webArtifactExists(webDistDir)) {
    app.use(createWebRouter(webDistDir));
  } else if (webDistDir) {
    logger.warn('Web interface artifact not found; serving API only');
  }
  app.use(apiNotFound);
  app.use(createErrorHandler(logger));

  return app;
}
