import type { Request, Response } from 'express';
import { RegisterUserUseCase } from '../use-cases/register-user/register-user.use-case.js';
export declare class RegisterUserController {
    private registerUserUseCase;
    constructor(registerUserUseCase: RegisterUserUseCase);
    handle(req: Request, res: Response): Promise<Response>;
}
//# sourceMappingURL=register-user.controller.d.ts.map