import type { Request, Response } from 'express';
import type { ListCompaniesUseCase } from '../use-cases/list-companies/list-companies.use-case.js';
export declare class ListCompaniesController {
    private listCompaniesUseCase;
    constructor(listCompaniesUseCase: ListCompaniesUseCase);
    handle(request: Request, response: Response): Promise<Response>;
}
//# sourceMappingURL=list-companies.controller.d.ts.map