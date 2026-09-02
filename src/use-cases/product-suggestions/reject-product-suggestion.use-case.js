import { authorizeProductSuggestion } from './authorize-product-suggestion.js';
import { aiTelemetry, recordAiTelemetryBestEffort } from '../../infra/ai-telemetry.js';
import { logger } from '../../infra/logger.js';
export class RejectProductSuggestionUseCase {
    suggestions;
    stocks;
    telemetry;
    applicationLogger;
    constructor(suggestions, stocks, telemetry = aiTelemetry, applicationLogger = logger) {
        this.suggestions = suggestions;
        this.stocks = stocks;
        this.telemetry = telemetry;
        this.applicationLogger = applicationLogger;
    }
    async execute({ suggestionId, userId }) {
        await authorizeProductSuggestion(suggestionId, userId, this.suggestions, this.stocks);
        const rejected = await this.suggestions.reject(suggestionId, userId);
        await recordAiTelemetryBestEffort(() => this.telemetry.recordSuggestion({ decision: 'rejected', confidence: rejected.confidence }), this.applicationLogger, { event: 'ai_suggestion', decision: 'rejected' });
        return rejected;
    }
}
//# sourceMappingURL=reject-product-suggestion.use-case.js.map