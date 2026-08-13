import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
export declare class ConfirmProductSuggestionUseCase {
    private suggestions;
    private stocks;
    constructor(suggestions: IProductSuggestionRepository, stocks: Pick<IStockRepository, 'findByIdForUser'>);
    execute({ suggestionId, userId }: {
        suggestionId: string;
        userId: string;
    }): Promise<import("../../repositories/product-suggestion.repository.js").IProductSimilaritySuggestion>;
}
//# sourceMappingURL=confirm-product-suggestion.use-case.d.ts.map