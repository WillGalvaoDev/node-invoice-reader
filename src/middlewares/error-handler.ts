import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

export function errorHandler(
  error: Error,
  request: Request,
  response: Response,
  // O Express exige o parâmetro 'next' para reconhecer como middleware de erro:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  // Se for um erro conhecido da nossa aplicação (lançado via AppError)
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
  }

  // Log no servidor para podermos debugar erros inesperados em dev
  console.error('[Internal Error]:', error);

  // Erro não tratado / inesperado (ex: falha de banco, queda de rede)
  return response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}