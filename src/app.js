import express, {} from 'express';
import { logger as applicationLogger } from './infra/logger.js';
import { configureTrustProxy } from './config/trust-proxy.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { createHttpSecurityMiddlewares } from './middlewares/http-security.js';
import { createErrorHandler } from './middlewares/error-handler.js';
export function createOperationalState() {
    let shuttingDown = false;
    return {
        isShuttingDown: () => shuttingDown,
        beginShutdown: () => { shuttingDown = true; },
    };
}
export function createApp({ applicationRoutes, healthProbe, operationalState = createOperationalState(), logger = applicationLogger, trustProxyHops = 0, allowedOrigins = [], }) {
    const app = express();
    configureTrustProxy(app, trustProxyHops);
    app.use(requestIdMiddleware);
    app.use(...createHttpSecurityMiddlewares(allowedOrigins));
    app.get('/health', async (_request, response) => {
        if (operationalState.isShuttingDown()) {
            return response.status(503).json({ status: 'unavailable' });
        }
        try {
            await healthProbe();
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