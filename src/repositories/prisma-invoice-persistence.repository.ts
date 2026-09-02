import { ProductMapper } from '../mappers/product.mapper.js';
import { prisma } from '../infra/prisma.js';
import type { IInvoicePersistencePlan, IInvoicePersistenceRepository } from './invoice-persistence.repository.js';
import type { IProduct } from './product.repository.js';
import { AppError } from '../errors/app-error.js';
import { upsertWeightedProductEntry } from './prisma-weighted-product-entry.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';

export class PrismaInvoicePersistenceRepository implements IInvoicePersistenceRepository {
  async persist({ accessKey, stockId, operations, suggestions = [], correlationId }: IInvoicePersistencePlan): Promise<IProduct[]> {
    return prisma.$transaction(async (transaction) => {
      const products: IProduct[] = [];
      let processedInvoiceId: string;

      try {
        const processedInvoice = await transaction.processedInvoice.create({
          data: { accessKey, stockId, ...(correlationId !== undefined && { correlationId }) },
        });
        processedInvoiceId = processedInvoice.id;
      } catch (error) {
        if (isPrismaErrorCode(error, 'P2002')) {
          throw new AppError('Esta NF-e já foi processada.', 409);
        }

        throw error;
      }

      for (const { product } of operations) {
        const persisted = await upsertWeightedProductEntry(transaction, product);
        products.push(ProductMapper.toDomain(persisted));
      }

      if (suggestions.length > 0) {
        await transaction.productSimilaritySuggestion.createMany({
          data: suggestions.map((suggestion) => ({
            ...suggestion,
            processedInvoiceId,
            stockId,
          })),
        });
      }

      return products;
    });
  }

}
