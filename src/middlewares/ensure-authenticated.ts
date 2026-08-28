import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import type { ITokenProvider } from '../providers/token.provider.js';
import type { IUserRepository } from '../repositories/user.repository.js';

export interface AuthenticateMiddlewareDependencies {
  tokenProvider: ITokenProvider;
  userRepository: IUserRepository;
}

function bearerToken(authorization: string | undefined): string {
  if (!authorization) throw new AppError('JWT token não informado.', 401);
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new AppError('JWT token inválido ou expirado.', 401);
  }
  return parts[1];
}

export function createEnsureAuthenticated({ tokenProvider, userRepository }: AuthenticateMiddlewareDependencies): RequestHandler {
  return async function ensureAuthenticated(request: Request, _response: Response, next: NextFunction) {
    const token = bearerToken(request.headers.authorization);
    try {
      const decoded = await tokenProvider.verifyToken(token);
      if (!decoded?.sub) throw new AppError('JWT token inválido ou expirado.', 401);
      const user = await userRepository.findById(decoded.sub);
      if (!user) throw new AppError('Usuário não encontrado ou conta removida.', 401);
      // Revogação determinística (P2-02): comparação de inteiros, não de timestamp.
      // verifyToken já garante que decoded.authVersion é um inteiro válido quando não-nulo.
      if (user.authVersion !== decoded.authVersion) {
        throw new AppError('JWT token inválido ou expirado.', 401);
      }
      request.user = { id: decoded.sub };
      next();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('JWT token inválido ou expirado.', 401);
    }
  };
}
