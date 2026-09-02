import express, {} from 'express';
import { logger as applicationLogger } from './infra/logger.js';
import { configureTrustProxy } from './config/trust-proxy.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { createHttpSecurityMiddlewares } from './middlewares/http-security.js';
import { createErrorHandler } from './middlewares/error-handler.js';
import { createHealthRateLimiter } from './middlewares/health-rate-limiter.js';
export function createOperationalState() {
    let shuttingDown = false;
    return {
        isShuttingDown: () => shuttingDown,
        beginShutdown: () => { shuttingDown = true; },
    };
}
export function createApp({ applicationRoutes, healthProbe, operationalState = createOperationalState(), logger = applicationLogger, trustProxyHops = 0, allowedOrigins = [], healthCacheTtlMs = 5_000, healthRateLimiter = createHealthRateLimiter(), }) {
    const app = express();
    let healthyUntil = 0;
    let pendingHealthProbe;
    const cachedHealthProbe = async () => {
        if (Date.now() < healthyUntil)
            return;
        pendingHealthProbe ??= healthProbe()
            .then(() => { healthyUntil = Date.now() + healthCacheTtlMs; })
            .finally(() => { pendingHealthProbe = undefined; });
        await pendingHealthProbe;
    };
    configureTrustProxy(app, trustProxyHops);
    app.use(requestIdMiddleware);
    app.use(...createHttpSecurityMiddlewares(allowedOrigins));
    const rejectHealthDuringShutdown = (_request, response, next) => {
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
        }
        catch (error) {
            logger.warn('Database health check failed', {
                error: { name: error instanceof Error ? error.name : 'UnknownError' },
            });
            return response.status(503).json({ status: 'unavailable' });
        }
    });
    app.use(express.json());
    app.use(applicationRoutes);
    app.use(createErrorHandler(logger));
    return app;
}
//# sourceMappingURL=app.js.map