import type { IStock, IStockRepository } from '../stock.repository.js';
export declare class InMemoryStockRepository implements IStockRepository {
    items: IStock[];
    createAuthorizedUserIds: Map<string, Set<string>>;
    viewAuthorizedUserIds: Map<string, Set<string>>;
    create(stock: IStock): Promise<IStock>;
    findById(id: string): Promise<IStock | null>;
    findByIdForUser(id: string, userId: string): Promise<IStock | null>;
    findByIdForViewer(id: string, userId: string): Promise<IStock | null>;
    findByCompanyId(companyId: string): Promise<IStock[]>;
}
//# sourceMappingURL=in-memory-stock.repository.d.ts.map