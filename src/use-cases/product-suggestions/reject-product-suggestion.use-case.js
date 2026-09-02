import { authorizeProductSuggestion } from './authorize-product-suggestion.js';
import { aiTelemetry, recordAiTelemetryBestEffort } from '../../infra/ai-telemetry.js';
import { logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { auditEvents } from '../audit-events.js';
export class RejectProductSuggestionUseCase {
    suggestions;
    stocks;
    auditLogRepository;
    telemetry;
    applicationLogger;
    constructor(suggestions, stocks, auditLogRepository, telemetry = aiTelemetry, applicationLogger = logger) {
        this.suggestions = suggestions;
        this.stocks = stocks;
        this.auditLogRepository = auditLogRepository;
        this.telemetry = telemetry;
        this.applicationLogger = applicationLogger;
    }
    async execute({ suggestionId, userId }) {
        const { companyId } = await authorizeProductSuggestion(suggestionId, userId, this.suggestions, this.stocks);
        const { suggestion, productId, previousProduct, nextProduct } = await this.suggestions.reject(suggestionId, userId);
        await recordAiTelemetryBestEffort(() => this.telemetry.recordSuggestion({ decision: 'rejected', confidence: suggestion.confidence }), this.applicationLogger, { event: 'ai_suggestion', decision: 'rejected' });
        await persistAuditBestEffort({
            repository: this.auditLogRepository,
            logger: this.applicationLogger,
            log: auditEvents.productSuggestionDecided({
                userId, companyId, stockId: suggestion.stockId, productId,
                decision: 'rejected', previous: previousProduct, next: nextProduct,
            }),
        });
        return suggestion;
    }
}
//# sourceMappingURL=reject-product-suggestion.use-case.js.map