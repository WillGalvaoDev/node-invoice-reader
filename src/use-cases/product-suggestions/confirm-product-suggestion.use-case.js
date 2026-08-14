import { authorizeProductSuggestion } from './authorize-product-suggestion.js';
import { aiTelemetry, recordAiTelemetryBestEffort } from '../../infra/ai-telemetry.js';
import { logger } from '../../infra/logger.js';
export class ConfirmProductSuggestionUseCase {
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
        const confirmed = await this.suggestions.confirm(suggestionId, userId);
        recordAiTelemetryBestEffort(() => this.telemetry.recordSuggestion({ decision: 'confirmed', confidence: confirmed.confidence }), this.applicationLogger, { event: 'ai_suggestion', decision: 'confirmed' });
        return confirmed;
    }
}
//# sourceMappingURL=confirm-product-suggestion.use-case.js.map