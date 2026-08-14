import type { IProductSimilaritySuggestion, IProductSuggestionRepository } from './product-suggestion.repository.js';
export declare class PrismaProductSuggestionRepository implements IProductSuggestionRepository {
    findById(id: string): Promise<IProductSimilaritySuggestion | null>;
    findPendingByStockId(stockId: string): Promise<IProductSimilaritySuggestion[]>;
    confirm(id: string, userId: string): Promise<IProductSimilaritySuggestion>;
    reject(id: string, userId: string): Promise<IProductSimilaritySuggestion>;
}
//# sourceMappingURL=prisma-product-suggestion.repository.d.ts.map