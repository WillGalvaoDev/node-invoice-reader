import type { ICompanyRepository } from '../../repositories/company.repository.js';
export type CompanyAccessRole = 'OWNER' | 'COLLABORATOR';
export interface IAccessibleCompany {
    id: string;
    name: string;
    cnpj: string;
    createdAt: Date;
    role: CompanyAccessRole;
}
export interface IAccessibleCompanyPage {
    items: IAccessibleCompany[];
    nextCursor: string | null;
}
interface IListCompaniesRequest {
    userId: string;
    limit: number;
    cursor?: string | undefined;
}
export declare class ListCompaniesUseCase {
    private readonly companyRepository;
    constructor(companyRepository: ICompanyRepository);
    execute({ userId, limit, cursor }: IListCompaniesRequest): Promise<IAccessibleCompanyPage>;
    private toAccessibleCompany;
}
export {};
//# sourceMappingURL=list-companies.use-case.d.ts.map