import type { Stock as PrismaStock } from '@prisma/client';
import type { IStock } from '../repositories/stock.repository.js';
export declare class StockMapper {
    static toDomain(raw: PrismaStock): IStock;
}
//# sourceMappingURL=stock.mapper.d.ts.map