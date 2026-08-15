import type { ICompanyRepository, ICompany } from './company.repository.js';
import type { IStock } from './stock.repository.js';
export declare class PrismaCompanyRepository implements ICompanyRepository {
    create(company: ICompany): Promise<ICompany>;
    createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{
        company: ICompany;
        stock: IStock;
    }>;
    findById(id: string): Promise<ICompany | null>;
    findByOwnerId(ownerId: string): Promise<ICompany[]>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=prisma-company.repository.d.ts.map