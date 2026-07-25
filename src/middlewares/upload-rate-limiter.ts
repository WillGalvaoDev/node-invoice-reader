import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 uploads por minuto

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    // Rate limit por usuário autenticado
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // Fallback para IP (tratando IPv6 corretamente)
    return `ip:${ipKeyGenerator(req.ip!)}`;
  },

  handler: (_req, _res, _next) => {
    throw new AppError(
      'Limite de uploads atingido. Aguarde um minuto antes de enviar novas notas.',
      429,
    );
  },
});

export default uploadRateLimiter;