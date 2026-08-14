import type { Product as PrismaProduct } from '@prisma/client';
import type { IProduct } from '../repositories/product.repository.js';
export declare class ProductMapper {
    static toDomain(raw: PrismaProduct): IProduct;
}
//# sourceMappingURL=product.mapper.d.ts.map