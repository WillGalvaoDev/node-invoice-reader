import type { ICompany, ICompanyRepository } from '../company.repository.js';
export declare class InMemoryCompanyRepository implements ICompanyRepository {
    items: ICompany[];
    create(company: ICompany): Promise<ICompany>;
    findById(id: string): Promise<ICompany | null>;
    findByOwnerId(ownerId: string): Promise<ICompany[]>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=in-memory-company.repository.d.ts.map