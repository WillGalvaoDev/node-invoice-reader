import type { IStockRepository, IStock } from './stock.repository.js';
import { prisma } from '../infra/prisma.js';

export class PrismaStockRepository implements IStockRepository {
  async create(stock: IStock): Promise<IStock> {
    const createdStock = await prisma.stock.create({
      data: {
        name: stock.name,
        companyId: stock.companyId,
      },
    });

    return createdStock as IStock;
  }

  async findById(id: string): Promise<IStock | null> {
    const stock = await prisma.stock.findUnique({
      where: { id },
    });

    return stock as IStock | null;
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

    return stock as IStock | null;
  }

  async findByCompanyId(companyId: string): Promise<IStock[]> {
    const stocks = await prisma.stock.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return stocks as IStock[];
  }
}
