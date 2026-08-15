import type { IStock } from './stock.repository.js';
export interface ICompany {
    id?: string;
    name: string;
    cnpj: string;
    ownerId: string;
    createdAt?: Date;
}
export interface ICompanyRepository {
    create(company: ICompany): Promise<ICompany>;
    createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{
        company: ICompany;
        stock: IStock;
    }>;
    findById(id: string): Promise<ICompany | null>;
    findByOwnerId(ownerId: string): Promise<ICompany[]>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=company.repository.d.ts.map