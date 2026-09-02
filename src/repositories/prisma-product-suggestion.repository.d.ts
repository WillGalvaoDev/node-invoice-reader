import type { IProductSimilaritySuggestion, IProductSuggestionDecision, IProductSuggestionRepository } from './product-suggestion.repository.js';
export declare class PrismaProductSuggestionRepository implements IProductSuggestionRepository {
    findById(id: string): Promise<IProductSimilaritySuggestion | null>;
    findPendingByStockId(stockId: string): Promise<IProductSimilaritySuggestion[]>;
    confirm(id: string, userId: string): Promise<IProductSuggestionDecision>;
    reject(id: string, userId: string): Promise<IProductSuggestionDecision>;
}
//# sourceMappingURL=prisma-product-suggestion.repository.d.ts.map