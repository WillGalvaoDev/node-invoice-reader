import type { Request, Response, NextFunction } from 'express';
import { type Logger } from '../infra/logger.js';
export declare function createErrorHandler(logger: Logger): (error: Error, request: Request, response: Response, _next: NextFunction) => Response<any, Record<string, any>>;
export declare const errorHandler: (error: Error, request: Request, response: Response, _next: NextFunction) => Response<any, Record<string, any>>;
//# sourceMappingURL=error-handler.d.ts.map