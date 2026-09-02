import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';

export const HEALTH_RATE_LIMIT_POLICY = {
  windowMs: 60_000,
  max: 60,
} as const;

interface HealthRateLimiterOptions {
  windowMs?: number;
  max?: number;
}

export function createHealthRateLimiter({
  windowMs = HEALTH_RATE_LIMIT_POLICY.windowMs,
  max = HEALTH_RATE_LIMIT_POLICY.max,
}: HealthRateLimiterOptions = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request) => `ip:${ipKeyGenerator(request.ip ?? '')}`,
    handler: (_request, _response, next) => next(new AppError(
      'Limite de verificações de saúde atingido. Tente novamente mais tarde.',
      429,
    )),
  });
}

