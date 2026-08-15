import type { ICompany, ICompanyRepository } from '../company.repository.js';
import type { IStock } from '../stock.repository.js';
export declare class InMemoryCompanyRepository implements ICompanyRepository {
    items: ICompany[];
    stocks: IStock[];
    failNextStockCreation: boolean;
    create(company: ICompany): Promise<ICompany>;
    createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{
        company: ICompany;
        stock: IStock;
    }>;
    findById(id: string): Promise<ICompany | null>;
    findByOwnerId(ownerId: string): Promise<ICompany[]>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=in-memory-company.repository.d.ts.map