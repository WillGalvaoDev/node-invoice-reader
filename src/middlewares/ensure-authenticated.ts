import type { Request, Response, NextFunction } from 'express';
import { JoseTokenProvider } from '../providers/implementations/jose-token.provider.js';

export async function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // 1. Verifica se o header Authorization foi enviado
  if (!authHeader) {
    return res.status(401).json({ error: 'Token is missing.' });
  }

  // 2. O formato esperado é "Bearer <token>", então dividimos a string
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ error: 'Token is missing.' });
  }

  try {
    // 3. Instancia o provider do jose para validar o token e extrair o payload
    const tokenProvider = new JoseTokenProvider();
    const decoded = await tokenProvider.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // 4. Injeta o ID do usuário dentro do objeto 'req' para os próximos passos usarem
    req.user = {
      id: decoded.sub,
    };

    // 5. Autoriza a requisição a prosseguir para o Controller
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}