import type { ICompanyRepository, ICompany } from '../../repositories/company.repository.js';
import type { IStock } from '../../repositories/stock.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import { type Logger } from '../../infra/logger.js';
interface ICreateCompanyRequest {
    name: string;
    cnpj: string;
    ownerId: string;
    requestId?: string | undefined;
}
interface ICreateCompanyResponse {
    company: ICompany;
    defaultStock: IStock;
}
export declare class CreateCompanyUseCase {
    private readonly companyRepository;
    private readonly auditLogRepository;
    private readonly applicationLogger;
    constructor(companyRepository: ICompanyRepository, auditLogRepository: IAuditLogRepository, applicationLogger?: Logger);
    execute({ name, cnpj, ownerId, requestId }: ICreateCompanyRequest): Promise<ICreateCompanyResponse>;
}
export {};
//# sourceMappingURL=create-company.use-case.d.ts.map