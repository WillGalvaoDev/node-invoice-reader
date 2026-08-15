import type { ICompanyRepository } from '../../repositories/company.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { type Logger } from '../../infra/logger.js';
export interface IViewableStock {
    id: string;
    name: string;
    createdAt: Date;
}
export interface IViewableStockPage {
    items: IViewableStock[];
    nextCursor: string | null;
}
interface IListCompanyStocksRequest {
    userId: string;
    companyId: string;
    limit: number;
    cursor?: string | undefined;
    requestId?: string | undefined;
}
export declare class ListCompanyStocksUseCase {
    private readonly companyRepository;
    private readonly stockRepository;
    private readonly applicationLogger;
    constructor(companyRepository: Pick<ICompanyRepository, 'findAccessibleById'>, stockRepository: Pick<IStockRepository, 'findByIdForViewer' | 'findViewablePageByCompanyId'>, applicationLogger?: Logger);
    execute({ userId, companyId, limit, cursor, requestId }: IListCompanyStocksRequest): Promise<IViewableStockPage>;
    private toViewableStock;
}
export {};
//# sourceMappingURL=list-company-stocks.use-case.d.ts.map