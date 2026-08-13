import express from 'express';
import { routes } from './routes.js';
import { errorHandler } from './middlewares/error-handler.js';
import { env } from './config/env.js';
import { configureTrustProxy } from './config/trust-proxy.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { logger } from './infra/logger.js';
import { createHttpSecurityMiddlewares } from './middlewares/http-security.js';

const app = express();

configureTrustProxy(app, env.TRUST_PROXY_HOPS);
app.use(requestIdMiddleware);

app.use(...createHttpSecurityMiddlewares(env.CORS_ALLOWED_ORIGINS));

// Middleware para decodificar JSON no corpo das requisições
app.use(express.json());

// Acopla as nossas rotas estruturadas (Multer, Rotas e Controllers)
app.use(routes);
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info('HTTP server started', { port: env.PORT });
});
