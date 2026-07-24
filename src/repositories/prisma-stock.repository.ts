import { PrismaClient } from '@prisma/client';
import type { IStockRepository, IStock } from './stock.repository.js';
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

  async findByCompanyId(companyId: string): Promise<IStock[]> {
    const stocks = await prisma.stock.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return stocks as IStock[];
  }
}