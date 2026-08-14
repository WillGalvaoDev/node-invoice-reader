import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { type IAiTelemetry } from '../../infra/ai-telemetry.js';
import { type Logger } from '../../infra/logger.js';
export declare class ConfirmProductSuggestionUseCase {
    private suggestions;
    private stocks;
    private telemetry;
    private applicationLogger;
    constructor(suggestions: IProductSuggestionRepository, stocks: Pick<IStockRepository, 'findByIdForUser'>, telemetry?: IAiTelemetry, applicationLogger?: Logger);
    execute({ suggestionId, userId }: {
        suggestionId: string;
        userId: string;
    }): Promise<import("../../repositories/product-suggestion.repository.js").IProductSimilaritySuggestion>;
}
//# sourceMappingURL=confirm-product-suggestion.use-case.d.ts.map