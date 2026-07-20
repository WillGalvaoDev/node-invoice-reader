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
        userId: product.userId ?? null,
      },
    });

    console.log(`💾 [Prisma Banco Real] Produto persistido com sucesso: ${createdProduct.description}`);
    return createdProduct;
  }

  async findByCode(code: string): Promise<IProduct | null> {
    const product = await prisma.product.findFirst({
      where: { code },
    });

    return product;
  }
}