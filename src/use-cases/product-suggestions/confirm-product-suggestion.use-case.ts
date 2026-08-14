import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { authorizeProductSuggestion } from './authorize-product-suggestion.js';
import { aiTelemetry, recordAiTelemetryBestEffort, type IAiTelemetry } from '../../infra/ai-telemetry.js';
import { logger, type Logger } from '../../infra/logger.js';

export class ConfirmProductSuggestionUseCase {
  constructor(
    private suggestions: IProductSuggestionRepository,
    private stocks: Pick<IStockRepository, 'findByIdForUser'>,
    private telemetry: IAiTelemetry = aiTelemetry,
    private applicationLogger: Logger = logger,
  ) {}

  async execute({ suggestionId, userId }: { suggestionId: string; userId: string }) {
    await authorizeProductSuggestion(suggestionId, userId, this.suggestions, this.stocks);
    const confirmed = await this.suggestions.confirm(suggestionId, userId);
    recordAiTelemetryBestEffort(
      () => this.telemetry.recordSuggestion({ decision: 'confirmed', confidence: confirmed.confidence }),
      this.applicationLogger,
      { event: 'ai_suggestion', decision: 'confirmed' },
    );
    return confirmed;
  }
}
