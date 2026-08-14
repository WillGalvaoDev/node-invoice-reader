import type { Request, Response } from 'express';
import { LoginUseCase } from '../use-cases/login/login.use-case.js';
export declare class LoginController {
    private loginUseCase;
    constructor(loginUseCase: LoginUseCase);
    handle(req: Request, res: Response): Promise<Response>;
}
//# sourceMappingURL=login.controller.d.ts.map