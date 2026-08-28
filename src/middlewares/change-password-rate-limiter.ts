import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';

// Sem rate limit próprio, a rota vira um oráculo de verificação de senha com
// custo Argon2 por tentativa — o mesmo problema que uploadRateLimiter resolve
// para o upload. Mesmo padrão: por usuário, com fallback por IP.
export const changePasswordRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    return `ip:${ipKeyGenerator(req.ip!)}`;
  },

  handler: (_req, _res, next) => {
    next(new AppError(
      'Limite de tentativas de troca de senha atingido. Aguarde um minuto antes de tentar novamente.',
      429,
    ));
  },
});

export default changePasswordRateLimiter;
