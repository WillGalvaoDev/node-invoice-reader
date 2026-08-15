import type { ICompanyRepository, ICompany, ICompanyPage, ICompanyPageQuery } from './company.repository.js';
import type { IStock } from './stock.repository.js';
export declare class PrismaCompanyRepository implements ICompanyRepository {
    create(company: ICompany): Promise<ICompany>;
    createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{
        company: ICompany;
        stock: IStock;
    }>;
    findById(id: string): Promise<ICompany | null>;
    private accessibleWhere;
    findAccessibleById(id: string, userId: string): Promise<ICompany | null>;
    findAccessiblePageByUserId({ userId, limit, cursor }: ICompanyPageQuery): Promise<ICompanyPage>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=prisma-company.repository.d.ts.map