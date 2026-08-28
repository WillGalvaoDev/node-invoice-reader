import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';
// Sem rate limit próprio, o teto por usuário de P4-02 é contornável criando
// empresas em volume (P4-03). Mesmo padrão de uploadRateLimiter: por usuário,
// com fallback por IP.
export const createCompanyRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        if (req.user?.id) {
            return `user:${req.user.id}`;
        }
        return `ip:${ipKeyGenerator(req.ip)}`;
    },
    handler: (_req, _res, next) => {
        next(new AppError('Limite de criação de empresas atingido. Aguarde um minuto antes de tentar novamente.', 429));
    },
});
export default createCompanyRateLimiter;
//# sourceMappingURL=create-company-rate-limiter.js.map