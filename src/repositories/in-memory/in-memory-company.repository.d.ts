import type { ICompany, ICompanyPage, ICompanyPageQuery, ICompanyRepository } from '../company.repository.js';
import type { IStock } from '../stock.repository.js';
export declare class InMemoryCompanyRepository implements ICompanyRepository {
    items: ICompany[];
    stocks: IStock[];
    failNextStockCreation: boolean;
    collaboratorUserIds: Map<string, Set<string>>;
    create(company: ICompany): Promise<ICompany>;
    createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{
        company: ICompany;
        stock: IStock;
    }>;
    findById(id: string): Promise<ICompany | null>;
    private hasAccess;
    findAccessibleById(id: string, userId: string): Promise<ICompany | null>;
    findAccessiblePageByUserId({ userId, limit, cursor }: ICompanyPageQuery): Promise<ICompanyPage>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=in-memory-company.repository.d.ts.map