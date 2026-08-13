import type { IProductSimilaritySuggestion, IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
export declare function authorizeProductSuggestion(suggestionId: string, userId: string, suggestions: IProductSuggestionRepository, stocks: Pick<IStockRepository, 'findByIdForUser'>): Promise<IProductSimilaritySuggestion>;
//# sourceMappingURL=authorize-product-suggestion.d.ts.map