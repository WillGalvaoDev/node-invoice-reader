import type { Product as PrismaProduct } from '@prisma/client';
import type { IProduct } from '../repositories/product.repository.js';

export class ProductMapper {
  static toDomain(raw: PrismaProduct): IProduct {
    return {
      id: raw.id,
      code: raw.code,
      ean: raw.ean,
      ncm: raw.ncm,
      description: raw.description,
      quantity: Number(raw.quantity), // 💡 Resolve o bug de concatenação ("3636")
      unitMeasurement: raw.unitMeasurement,
      unitPrice: Number(raw.unitPrice),
      totalPrice: Number(raw.totalPrice),
      createdAt: raw.createdAt,
      stockId: raw.stockId,
      userId: raw.userId,
    };
  }
}