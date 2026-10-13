import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { routes } from './routes.js';
import { env } from './config/env.js';
import { logger } from './infra/logger.js';
import { disconnectPrisma } from './infra/prisma.js';
import { checkDatabaseHealth } from './infra/health.js';
import { createApp, createOperationalState } from './app.js';
import { createHttpServer, createServerLifecycle, installProcessHandlers } from './server-lifecycle.js';

// src/index.js -> raiz do projeto -> web/dist (gerado no build; nunca versionado).
const WEB_DIST_DIR = fileURLToPath(new URL('../web/dist', import.meta.url));

export function startApplication() {
  const operationalState = createOperationalState();
  const app = createApp({
    applicationRoutes: routes,
    healthProbe: checkDatabaseHealth,
    operationalState,
    logger,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    allowedOrigins: env.CORS_ALLOWED_ORIGINS,
    webDistDir: WEB_DIST_DIR,
  });
  const server = createHttpServer(app, env.REQUEST_TIMEOUT_MS);
  const lifecycle = createServerLifecycle({
    server,
    operationalState,
    closeDatabase: disconnectPrisma,
    logger,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    exit: (code) => process.exit(code),
  });
  const uninstallProcessHandlers = installProcessHandlers({
    processEvents: process,
    shutdown: lifecycle.shutdown,
    logger,
  });

  server.listen(env.PORT, () => {
    logger.info('HTTP server started', { port: env.PORT });
  });

  return { app, server, lifecycle, uninstallProcessHandlers };
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  startApplication();
}
