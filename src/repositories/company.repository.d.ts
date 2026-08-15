import type { IStock } from './stock.repository.js';
export interface ICompany {
    id?: string;
    name: string;
    cnpj: string;
    ownerId: string;
    createdAt?: Date;
}
export interface ICompanyPageQuery {
    userId: string;
    limit: number;
    cursor?: string | undefined;
}
export interface ICompanyPage {
    items: ICompany[];
    nextCursor: string | null;
}
export interface ICompanyRepository {
    create(company: ICompany): Promise<ICompany>;
    createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{
        company: ICompany;
        stock: IStock;
    }>;
    findById(id: string): Promise<ICompany | null>;
    findAccessibleById(id: string, userId: string): Promise<ICompany | null>;
    findAccessiblePageByUserId(query: ICompanyPageQuery): Promise<ICompanyPage>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=company.repository.d.ts.map