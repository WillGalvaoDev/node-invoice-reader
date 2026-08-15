import type { Stock as PrismaStock } from '@prisma/client';
import type { IStock } from '../repositories/stock.repository.js';

export class StockMapper {
  static toDomain(raw: PrismaStock): IStock {
    return {
      id: raw.id,
      name: raw.name,
      companyId: raw.companyId,
      createdAt: raw.createdAt,
    };
  }
}
