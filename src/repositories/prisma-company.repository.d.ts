import type { ICompanyRepository, ICompany } from './company.repository.js';
export declare class PrismaCompanyRepository implements ICompanyRepository {
    create(company: ICompany): Promise<ICompany>;
    findById(id: string): Promise<ICompany | null>;
    findByOwnerId(ownerId: string): Promise<ICompany[]>;
    findByCnpj(cnpj: string): Promise<ICompany | null>;
}
//# sourceMappingURL=prisma-company.repository.d.ts.map