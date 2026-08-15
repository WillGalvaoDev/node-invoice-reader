import type { IStock, IStockPage, IStockPageQuery, IStockRepository } from '../stock.repository.js';
export declare class InMemoryStockRepository implements IStockRepository {
    items: IStock[];
    createAuthorizedUserIds: Map<string, Set<string>>;
    viewAuthorizedUserIds: Map<string, Set<string>>;
    companyOwnerId: Map<string, string>;
    create(stock: IStock): Promise<IStock>;
    findById(id: string): Promise<IStock | null>;
    findByIdForUser(id: string, userId: string): Promise<IStock | null>;
    private isViewable;
    findByIdForViewer(id: string, userId: string): Promise<IStock | null>;
    findViewablePageByCompanyId({ companyId, userId, limit, cursor }: IStockPageQuery): Promise<IStockPage>;
}
//# sourceMappingURL=in-memory-stock.repository.d.ts.map