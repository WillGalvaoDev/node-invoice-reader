import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import { authorizeProductSuggestion } from './authorize-product-suggestion.js';
import { aiTelemetry, recordAiTelemetryBestEffort, type IAiTelemetry } from '../../infra/ai-telemetry.js';
import { logger, type Logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { auditEvents } from '../audit-events.js';

export class RejectProductSuggestionUseCase {
  constructor(
    private suggestions: IProductSuggestionRepository,
    private stocks: Pick<IStockRepository, 'findByIdForUser'>,
    private auditLogRepository: IAuditLogRepository,
    private telemetry: IAiTelemetry = aiTelemetry,
    private applicationLogger: Logger = logger,
  ) {}

  async execute({ suggestionId, userId }: { suggestionId: string; userId: string }) {
    const { companyId } = await authorizeProductSuggestion(suggestionId, userId, this.suggestions, this.stocks);
    const { suggestion, productId, previousProduct, nextProduct } = await this.suggestions.reject(suggestionId, userId);

    await recordAiTelemetryBestEffort(
      () => this.telemetry.recordSuggestion({ decision: 'rejected', confidence: suggestion.confidence }),
      this.applicationLogger,
      { event: 'ai_suggestion', decision: 'rejected' },
    );

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
