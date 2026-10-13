import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';
/**
 * Protege a criação de registros do ambiente de demonstração (preparar/reiniciar).
 * Independente de qualquer cota de IA: não consome nem substitui o ledger.
 */
export function createDemoCommandRateLimiter(maxPerMinute) {
    return rateLimit({
        windowMs: 60 * 1000,
        limit: maxPerMinute,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (request) => request.user?.id
            ? `user:${request.user.id}`
            : `ip:${ipKeyGenerator(request.ip)}`,
        handler: (_request, _response, next) => {
            next(new AppError('Limite de comandos da demonstração atingido. Aguarde um minuto antes de tentar novamente.', 429));
        },
    });
}
//# sourceMappingURL=demo-command-rate-limiter.js.map