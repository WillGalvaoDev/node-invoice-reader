import { PrismaClient } from '@prisma/client';
import type { IProductRepository, IProduct } from './product.repository.js';
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export class PrismaProductRepository implements IProductRepository {
  async save(product: IProduct): Promise<IProduct> {
    const createdProduct = await prisma.product.create({
      data: {
        code: product.code,
        description: product.description,
        quantity: product.quantity,
        unitMeasurement: product.unitMeasurement,
        unitPrice: product.unitPrice,
        totalPrice: product.totalPrice,
        stockId: product.stockId, // 👈 Mapeado para o novo campo no Postgres
        userId: product.userId ?? null,
      },
    });

    console.log(`💾 [Prisma Banco Real] Produto persistido com sucesso: ${createdProduct.description}`);
    return createdProduct as IProduct;
  }

  async findByCode(code: string, stockId: string): Promise<IProduct | null> {
    const product = await prisma.product.findFirst({
      where: { 
        code,
        stockId,
      },
    });

    return product as IProduct | null;
  }

  async findByUserId(userId: string): Promise<IProduct[]> {
    const products = await prisma.product.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return products as IProduct[];
  }

  async findByStockId(stockId: string): Promise<IProduct[]> {
    const products = await prisma.product.findMany({
      where: {
        stockId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return products as IProduct[];
  }

  async findById(id: string): Promise<IProduct | null> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    return product as IProduct | null;
  }

  async update(id: string, data: Partial<IProduct>): Promise<IProduct> {
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unitMeasurement !== undefined && { unitMeasurement: data.unitMeasurement }),
        ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
        ...(data.totalPrice !== undefined && { totalPrice: data.totalPrice }),
        ...(data.stockId !== undefined && { stockId: data.stockId }),
        ...(data.userId !== undefined && { userId: data.userId ?? null }),
      },
    });

    return updatedProduct as IProduct;
  }

  async delete(id: string): Promise<void> {
    await prisma.product.delete({
      where: { id },
    });
  }
}