import type { IProductRepository, IProduct } from './product.repository.js';
import { ProductMapper } from '../mappers/product.mapper.js';
import { prisma } from '../infra/prisma.js';

export class PrismaProductRepository implements IProductRepository {
  async save(product: IProduct): Promise<IProduct> {
    const createdProduct = await prisma.product.create({
      data: {
        code: product.code,
        description: product.description,
        quantity: Number(product.quantity),
        unitMeasurement: product.unitMeasurement,
        unitPrice: Number(product.unitPrice),
        totalPrice: Number(product.totalPrice),
        stockId: product.stockId,
        userId: product.userId ?? null,
      },
    });

    return ProductMapper.toDomain(createdProduct);
  }

  async findByCode(code: string, stockId: string): Promise<IProduct | null> {
    const product = await prisma.product.findFirst({
      where: { code, stockId },
    });

    if (!product) return null;

    return ProductMapper.toDomain(product);
  }

  async findByUserId(userId: string): Promise<IProduct[]> {
    const products = await prisma.product.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return products.map(ProductMapper.toDomain);
  }

  async findByStockId(stockId: string, userId?: string): Promise<IProduct[]> {
    const products = await prisma.product.findMany({
      where: {
        stockId,
        ...(userId && { userId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map(ProductMapper.toDomain);
  }

  async findByCompanyId(companyId: string, userId?: string): Promise<IProduct[]> {
    const products = await prisma.product.findMany({
      where: {
        stock: {
          companyId,
        },
        ...(userId && { userId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map(ProductMapper.toDomain);
  }

  async findById(id: string): Promise<IProduct | null> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) return null;

    return ProductMapper.toDomain(product);
  }

  async update(id: string, data: Partial<IProduct>): Promise<IProduct> {
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.quantity !== undefined && { quantity: Number(data.quantity) }),
        ...(data.unitMeasurement !== undefined && { unitMeasurement: data.unitMeasurement }),
        ...(data.unitPrice !== undefined && { unitPrice: Number(data.unitPrice) }),
        ...(data.totalPrice !== undefined && { totalPrice: Number(data.totalPrice) }),
        ...(data.stockId !== undefined && { stockId: data.stockId }),
        ...(data.userId !== undefined && { userId: data.userId ?? null }),
      },
    });

    return ProductMapper.toDomain(updatedProduct);
  }

  async delete(id: string): Promise<void> {
    await prisma.product.delete({
      where: { id },
    });
  }
}
