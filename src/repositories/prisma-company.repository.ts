import type { ICompanyRepository, ICompany, ICompanyPage, ICompanyPageQuery } from './company.repository.js';
import type { IStock } from './stock.repository.js';
import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
import { CompanyMapper } from '../mappers/company.mapper.js';
import { StockMapper } from '../mappers/stock.mapper.js';

export class PrismaCompanyRepository implements ICompanyRepository {
  async create(company: ICompany): Promise<ICompany> {
    let createdCompany;
    try {
      createdCompany = await prisma.company.create({
        data: {
          name: company.name,
          cnpj: company.cnpj,
          ownerId: company.ownerId,
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
      }
      if (isPrismaErrorCode(error, 'P2003')) {
        throw new AppError('Usuário responsável inválido.', 400);
      }
      throw error;
    }

    return CompanyMapper.toDomain(createdCompany);
  }

  async createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{ company: ICompany; stock: IStock }> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const createdCompany = await transaction.company.create({
          data: {
            name: company.name,
            cnpj: company.cnpj,
            ownerId: company.ownerId,
          },
        });

        const createdStock = await transaction.stock.create({
          data: {
            name: defaultStockName,
            companyId: createdCompany.id,
          },
        });

        return { company: CompanyMapper.toDomain(createdCompany), stock: StockMapper.toDomain(createdStock) };
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
      }
      if (isPrismaErrorCode(error, 'P2003')) {
        throw new AppError('Usuário responsável inválido.', 400);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ICompany | null> {
    const company = await prisma.company.findUnique({
      where: { id },
    });

    return company ? CompanyMapper.toDomain(company) : null;
  }

  // Predicado de autorização vive no repositório, não no use case: owner tem acesso
  // implícito a tudo que possui; colaborador só através de CompanyCollaborator (P1-01).
  private accessibleWhere(userId: string) {
    return {
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId } } },
      ],
    };
  }

  async findAccessibleById(id: string, userId: string): Promise<ICompany | null> {
    const company = await prisma.company.findFirst({
      where: { id, ...this.accessibleWhere(userId) },
    });

    return company ? CompanyMapper.toDomain(company) : null;
  }

  async findAccessiblePageByUserId({ userId, limit, cursor }: ICompanyPageQuery): Promise<ICompanyPage> {
    const companies = await prisma.company.findMany({
      where: this.accessibleWhere(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = companies.slice(0, limit).map(CompanyMapper.toDomain);
    return { items, nextCursor: companies.length > limit ? items.at(-1)?.id ?? null : null };
  }

  // 👈 Método adicionado:
  async findByCnpj(cnpj: string): Promise<ICompany | null> {
    const company = await prisma.company.findUnique({
      where: { cnpj },
    });

    return company ? CompanyMapper.toDomain(company) : null;
  }
}
