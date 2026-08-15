import type { IStockRepository, IStock } from './stock.repository.js';
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

  async findByCompanyId(companyId: string): Promise<IStock[]> {
    const stocks = await prisma.stock.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return stocks.map(StockMapper.toDomain);
  }
}
