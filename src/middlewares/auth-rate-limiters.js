import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';
export const AUTH_RATE_LIMIT_POLICIES = {
    login: {
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: 'Limite de tentativas de login atingido. Tente novamente mais tarde.',
    },
    userRegistration: {
        windowMs: 60 * 60 * 1000,
        max: 5,
        message: 'Limite de cadastros atingido. Tente novamente mais tarde.',
    },
};
export function createIpRateLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (request) => `ip:${ipKeyGenerator(request.ip ?? '')}`,
        handler: (_request, _response, next) => next(new AppError(message, 429)),
    });
}
export const loginRateLimiter = createIpRateLimiter(AUTH_RATE_LIMIT_POLICIES.login);
export const userRegistrationRateLimiter = createIpRateLimiter(AUTH_RATE_LIMIT_POLICIES.userRegistration);
//# sourceMappingURL=auth-rate-limiters.js.map