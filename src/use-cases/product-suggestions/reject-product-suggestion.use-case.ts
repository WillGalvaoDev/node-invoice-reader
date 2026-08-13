import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { authorizeProductSuggestion } from './authorize-product-suggestion.js';

export class RejectProductSuggestionUseCase {
  constructor(private suggestions: IProductSuggestionRepository, private stocks: Pick<IStockRepository, 'findByIdForUser'>) {}

  async execute({ suggestionId, userId }: { suggestionId: string; userId: string }) {
    await authorizeProductSuggestion(suggestionId, userId, this.suggestions, this.stocks);
    return this.suggestions.reject(suggestionId, userId);
  }
}
