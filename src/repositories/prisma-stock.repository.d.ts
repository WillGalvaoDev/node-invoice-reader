import type { IStockRepository, IStock } from './stock.repository.js';
export declare class PrismaStockRepository implements IStockRepository {
    create(stock: IStock): Promise<IStock>;
    findById(id: string): Promise<IStock | null>;
    findByIdForUser(id: string, userId: string): Promise<IStock | null>;
    findByIdForViewer(id: string, userId: string): Promise<IStock | null>;
    findByCompanyId(companyId: string): Promise<IStock[]>;
}
//# sourceMappingURL=prisma-stock.repository.d.ts.map