import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';

const CORS_METHODS = ['GET', 'POST', 'OPTIONS'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Request-Id'];
const CORS_EXPOSED_HEADERS = ['X-Request-Id', 'Retry-After'];

export function createHttpSecurityMiddlewares(allowedOrigins: readonly string[]): RequestHandler[] {
  const allowlist = new Set(allowedOrigins);

  return [
    helmet({
      // This service is a JSON API and does not render executable HTML.
      contentSecurityPolicy: false,
    }),
    cors({
      origin: (origin, callback) => callback(null, origin === undefined || allowlist.has(origin)),
      methods: CORS_METHODS,
      allowedHeaders: CORS_ALLOWED_HEADERS,
      exposedHeaders: CORS_EXPOSED_HEADERS,
      credentials: false,
      optionsSuccessStatus: 204,
    }),
  ];
}
