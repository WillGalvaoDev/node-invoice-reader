import type { IStockRepository, IStock, IStockPage, IStockPageQuery } from './stock.repository.js';
import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
import { StockMapper } from '../mappers/stock.mapper.js';

export class PrismaStockRepository implements IStockRepository {
  async create(stock: IStock): Promise<IStock> {
    let createdStock;
    try {
      createdStock = await prisma.stock.create({
        data: {
          name: stock.name,
          companyId: stock.companyId,
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new AppError('Já existe um estoque com este nome nesta empresa.', 409);
      }
      if (isPrismaErrorCode(error, 'P2003')) {
        throw new AppError('Empresa relacionada inválida.', 400);
      }
      throw error;
    }

    return StockMapper.toDomain(createdStock);
  }

  async findById(id: string): Promise<IStock | null> {
    const stock = await prisma.stock.findUnique({
      where: { id },
    });

    return stock ? StockMapper.toDomain(stock) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<IStock | null> {
    const stock = await prisma.stock.findFirst({
      where: {
        id,
        company: {
          OR: [
            { ownerId: userId },
            {
              collaborators: {
                some: {
                  userId,
                  permissions: {
                    some: { stockId: id, canCreate: true },
                  },
                },
              },
            },
          ],
        },
      },
    });

    return stock ? StockMapper.toDomain(stock) : null;
  }

  async findByIdForViewer(id: string, userId: string): Promise<IStock | null> {
    const stock = await prisma.stock.findFirst({
      where: {
        id,
        company: {
          OR: [
            { ownerId: userId },
            {
              collaborators: {
                some: {
                  userId,
                  permissions: { some: { stockId: id, canView: true } },
                },
              },
            },
          ],
        },
      },
    });
    return stock ? StockMapper.toDomain(stock) : null;
  }

  // Owner tem acesso implícito a todo estoque da própria empresa, sem depender de
  // StockPermission; colaborador só através de canView (P1-02).
  async findViewablePageByCompanyId({ companyId, userId, limit, cursor }: IStockPageQuery): Promise<IStockPage> {
    const stocks = await prisma.stock.findMany({
      where: {
        companyId,
        OR: [
          { company: { ownerId: userId } },
          { permissions: { some: { canView: true, collaborator: { userId } } } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = stocks.slice(0, limit).map(StockMapper.toDomain);
    return { items, nextCursor: stocks.length > limit ? items.at(-1)?.id ?? null : null };
  }
}
