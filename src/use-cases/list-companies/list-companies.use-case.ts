import type { ICompany, ICompanyRepository } from '../../repositories/company.repository.js';
import { AppError } from '../../errors/app-error.js';

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

export class ListCompaniesUseCase {
  constructor(private readonly companyRepository: ICompanyRepository) {}

  async execute({ userId, limit, cursor }: IListCompaniesRequest): Promise<IAccessibleCompanyPage> {
    if (cursor) {
      const cursorCompany = await this.companyRepository.findAccessibleById(cursor, userId);
      if (!cursorCompany) throw new AppError('Cursor de empresa inválido.', 400);
    }

    const page = await this.companyRepository.findAccessiblePageByUserId({ userId, limit, cursor });

    return {
      items: page.items.map((company) => this.toAccessibleCompany(company, userId)),
      nextCursor: page.nextCursor,
    };
  }

  // Role é derivada em memória (ownerId === userId), sem query adicional: o
  // predicado de acesso já foi resolvido pelo repositório.
  private toAccessibleCompany(company: ICompany, userId: string): IAccessibleCompany {
    return {
      id: company.id as string,
      name: company.name,
      cnpj: company.cnpj,
      createdAt: company.createdAt as Date,
      role: company.ownerId === userId ? 'OWNER' : 'COLLABORATOR',
    };
  }
}
