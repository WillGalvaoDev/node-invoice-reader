import type { Request, Response } from 'express';
import type { CreateCompanyUseCase } from '../use-cases/create-company/create-company.use-case.js';
export declare class CreateCompanyController {
    private createCompanyUseCase;
    constructor(createCompanyUseCase: CreateCompanyUseCase);
    handle(request: Request, response: Response): Promise<Response>;
}
//# sourceMappingURL=create-company.controller.d.ts.map