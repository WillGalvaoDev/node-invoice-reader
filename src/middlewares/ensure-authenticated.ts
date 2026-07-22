import type { Request, Response, NextFunction } from 'express';
import { JoseTokenProvider } from '../providers/implementations/jose-token.provider.js';
import { AppError } from '../errors/app-error.js';

export async function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // 1. Verifica se o header Authorization foi enviado
  if (!authHeader) {
    throw new AppError('JWT token não informado.', 401);
  }

  // 2. Separa o "Bearer <token>"
  const [, token] = authHeader.split(' ');

  if (!token) {
    throw new AppError('JWT token não informado.', 401);
  }

  try {
    // 3. Valida o token
    const tokenProvider = new JoseTokenProvider();
    const decoded = await tokenProvider.verifyToken(token);

    if (!decoded || !decoded.sub) {
      throw new AppError('JWT token inválido.', 401);
    }

    // 4. Injeta o ID do usuário na requisição
    req.user = {
      id: decoded.sub,
    };

    return next();
  } catch {
    // Se o tokenProvider falhar ou expirar, cai aqui e padroniza a resposta
    throw new AppError('JWT token inválido ou expirado.', 401);
  }
}