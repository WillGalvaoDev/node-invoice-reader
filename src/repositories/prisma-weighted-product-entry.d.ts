import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import type { IProduct } from './product.repository.js';
export interface IProductEntryOptions {
    /**
     * `true` (notas): acumular só com origem conhecida igual e unidade igual.
     * `false` (decisão humana de confirmação): só a unidade precisa ser igual; a
     * origem do produto existente é preservada.
     */
    requireSameOrigin: boolean;
}
/**
 * Entrada ponderada atômica sobre `(stockId, code)`. A compatibilidade é
 * revalidada na própria cláusula ON CONFLICT: sob concorrência, o perdedor da
 * corrida avalia a linha já confirmada pelo vencedor e não soma em silêncio.
 */
export declare function upsertWeightedProductEntry(transaction: Prisma.TransactionClient, product: IProduct, { requireSameOrigin }: IProductEntryOptions): Promise<Product>;
/** Cria um produto novo; código já existente no estoque é conflito (409), nunca acúmulo. */
export declare function insertNewProductEntry(transaction: Prisma.TransactionClient, product: IProduct): Promise<Product>;
//# sourceMappingURL=prisma-weighted-product-entry.d.ts.map