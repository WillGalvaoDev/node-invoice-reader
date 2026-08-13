import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import type { IProduct } from './product.repository.js';
export declare function upsertWeightedProductEntry(transaction: Prisma.TransactionClient, product: IProduct): Promise<Product>;
//# sourceMappingURL=prisma-weighted-product-entry.d.ts.map