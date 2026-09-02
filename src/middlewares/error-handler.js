import { AppError } from '../errors/app-error.js';
import { GeminiQuotaExceededError } from '../errors/gemini-quota-exceeded.error.js';
import multer from 'multer';
import { logger as applicationLogger } from '../infra/logger.js';
export function createErrorHandler(logger) {
    return function handleError(error, request, response, _next) {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return response.status(413).json({
                status: 'error',
                message: 'Arquivo excede o limite de 10 MiB.',
            });
        }
        if (error instanceof GeminiQuotaExceededError) {
            response.set('Retry-After', String(error.retryAfterSeconds));
            return response.status(error.statusCode).json({
                status: 'error',
                message: error.message,
            });
        }
        if (error instanceof AppError) {
            return response.status(error.statusCode).json({
                status: 'error',
                message: error.message,
            });
        }
        logger.error('Unhandled request error', {
            requestId: request.requestId,
            error: { name: error.name },
        });
        return response.status(500).json({
            status: 'error',
            message: 'Erro interno do servidor.',
        });
    };
}
export const errorHandler = createErrorHandler(applicationLogger);
//# sourceMappingURL=error-handler.js.map