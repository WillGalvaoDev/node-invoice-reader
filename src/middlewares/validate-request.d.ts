import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
export declare function validateBody(schema: ZodType): (request: Request, _response: Response, next: NextFunction) => void;
export declare function validateQuery(schema: ZodType): (request: Request, _response: Response, next: NextFunction) => void;
export declare function validateParams(schema: ZodType): (request: Request, _response: Response, next: NextFunction) => void;
//# sourceMappingURL=validate-request.d.ts.map