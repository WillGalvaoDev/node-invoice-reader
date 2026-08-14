import type { ProductSimilaritySuggestion } from '@prisma/client';
import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { IProductSimilaritySuggestion, IProductSuggestionRepository } from './product-suggestion.repository.js';
import { upsertWeightedProductEntry } from './prisma-weighted-product-entry.js';

function toDomain(raw: ProductSimilaritySuggestion): IProductSimilaritySuggestion {
  return {
    id: raw.id,
    processedInvoiceId: raw.processedInvoiceId,
    itemIndex: raw.itemIndex,
    stockId: raw.stockId,
    suggestedProductId: raw.suggestedProductId,
    receivedCode: raw.receivedCode,
    receivedDescription: raw.receivedDescription,
    receivedQuantity: Number(raw.receivedQuantity),
    receivedUnitPrice: Number(raw.receivedUnitPrice),
    unitMeasurement: raw.unitMeasurement,
    confidence: Number(raw.confidence),
    reason: raw.reason,
    status: raw.status,
    decidedAt: raw.decidedAt,
    decidedByUserId: raw.decidedByUserId,
    createdAt: raw.createdAt,
  };
}

export class PrismaProductSuggestionRepository implements IProductSuggestionRepository {
  async findById(id: string): Promise<IProductSimilaritySuggestion | null> {
    const suggestion = await prisma.productSimilaritySuggestion.findUnique({ where: { id } });
    return suggestion ? toDomain(suggestion) : null;
  }

  async findPendingByStockId(stockId: string): Promise<IProductSimilaritySuggestion[]> {
    const suggestions = await prisma.productSimilaritySuggestion.findMany({
      where: { stockId, status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { itemIndex: 'asc' }],
    });
    return suggestions.map(toDomain);
  }

  async confirm(id: string, userId: string): Promise<IProductSimilaritySuggestion> {
    return prisma.$transaction(async (transaction) => {
      const claimed = await transaction.productSimilaritySuggestion.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CONFIRMED', decidedAt: new Date(), decidedByUserId: userId },
      });
      if (claimed.count !== 1) throw new AppError('Sugestão já decidida.', 409);

      const suggestion = await transaction.productSimilaritySuggestion.findUniqueOrThrow({
        where: { id }, include: { suggestedProduct: true },
      });
      if (suggestion.suggestedProduct.stockId !== suggestion.stockId) {
        throw new AppError('Sugestão incompatível com o estoque.', 409);
      }

      const product = await upsertWeightedProductEntry(transaction, {
        id: suggestion.suggestedProduct.id,
        code: suggestion.suggestedProduct.code,
        description: suggestion.receivedDescription,
        quantity: Number(suggestion.receivedQuantity),
        unitMeasurement: suggestion.unitMeasurement,
        unitPrice: Number(suggestion.receivedUnitPrice),
        totalPrice: Number(suggestion.receivedQuantity) * Number(suggestion.receivedUnitPrice),
        stockId: suggestion.stockId,
        userId,
      });
      if (product.id !== suggestion.suggestedProductId) {
        throw new AppError('Sugestão incompatível com o produto.', 409);
      }

      return toDomain(suggestion);
    });
  }

  async reject(id: string, userId: string): Promise<IProductSimilaritySuggestion> {
    return prisma.$transaction(async (transaction) => {
      const claimed = await transaction.productSimilaritySuggestion.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', decidedAt: new Date(), decidedByUserId: userId },
      });
      if (claimed.count !== 1) throw new AppError('Sugestão já decidida.', 409);

      const suggestion = await transaction.productSimilaritySuggestion.findUniqueOrThrow({ where: { id } });
      const product = await upsertWeightedProductEntry(transaction, {
        code: suggestion.receivedCode,
        description: suggestion.receivedDescription,
        quantity: Number(suggestion.receivedQuantity),
        unitMeasurement: suggestion.unitMeasurement,
        unitPrice: Number(suggestion.receivedUnitPrice),
        totalPrice: Number(suggestion.receivedQuantity) * Number(suggestion.receivedUnitPrice),
        stockId: suggestion.stockId,
        userId,
      });
      if (product.id === suggestion.suggestedProductId) {
        throw new AppError('A rejeição não pode alterar o produto sugerido.', 409);
      }

      return toDomain(suggestion);
    });
  }
}
