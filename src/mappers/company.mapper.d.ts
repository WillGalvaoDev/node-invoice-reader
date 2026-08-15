import type { Company as PrismaCompany } from '@prisma/client';
import type { ICompany } from '../repositories/company.repository.js';
export declare class CompanyMapper {
    static toDomain(raw: PrismaCompany): ICompany;
}
//# sourceMappingURL=company.mapper.d.ts.map