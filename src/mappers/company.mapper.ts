import type { Company as PrismaCompany } from '@prisma/client';
import type { ICompany } from '../repositories/company.repository.js';

export class CompanyMapper {
  static toDomain(raw: PrismaCompany): ICompany {
    return {
      id: raw.id,
      name: raw.name,
      cnpj: raw.cnpj,
      ownerId: raw.ownerId,
      createdAt: raw.createdAt,
    };
  }
}
