import type { Request, Response } from 'express';
import type { ChangePasswordUseCase } from '../use-cases/change-password/change-password.use-case.js';
export declare class ChangePasswordController {
    private changePasswordUseCase;
    constructor(changePasswordUseCase: ChangePasswordUseCase);
    handle(request: Request, response: Response): Promise<Response>;
}
//# sourceMappingURL=change-password.controller.d.ts.map