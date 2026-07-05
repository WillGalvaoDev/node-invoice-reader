import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import type { IProductRepository, IProduct } from './product.repository.js';

// Inicialização limpa e global da instância seguindo a sua ideia
const adapter = new PrismaLibSql({
  url: process.env["DATABASE_URL"]!,
});

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