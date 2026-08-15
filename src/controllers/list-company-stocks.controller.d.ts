import type { Request, Response } from 'express';
import type { ListCompanyStocksUseCase } from '../use-cases/list-company-stocks/list-company-stocks.use-case.js';
export declare class ListCompanyStocksController {
    private listCompanyStocksUseCase;
    constructor(listCompanyStocksUseCase: ListCompanyStocksUseCase);
    handle(request: Request, response: Response): Promise<Response>;
}
//# sourceMappingURL=list-company-stocks.controller.d.ts.map