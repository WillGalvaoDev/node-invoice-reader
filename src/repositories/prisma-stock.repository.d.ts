import type { IStockRepository, IStock, IStockPage, IStockPageQuery } from './stock.repository.js';
export declare class PrismaStockRepository implements IStockRepository {
    create(stock: IStock): Promise<IStock>;
    findById(id: string): Promise<IStock | null>;
    findByIdForUser(id: string, userId: string): Promise<IStock | null>;
    findByIdForViewer(id: string, userId: string): Promise<IStock | null>;
    findViewablePageByCompanyId({ companyId, userId, limit, cursor }: IStockPageQuery): Promise<IStockPage>;
}
//# sourceMappingURL=prisma-stock.repository.d.ts.map