import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
export declare class ListPendingProductSuggestionsUseCase {
    private suggestions;
    private stocks;
    constructor(suggestions: IProductSuggestionRepository, stocks: Pick<IStockRepository, 'findByIdForUser'>);
    execute({ stockId, userId }: {
        stockId: string;
        userId: string;
    }): Promise<import("../../repositories/product-suggestion.repository.js").IProductSimilaritySuggestion[]>;
}
//# sourceMappingURL=list-pending-product-suggestions.use-case.d.ts.map