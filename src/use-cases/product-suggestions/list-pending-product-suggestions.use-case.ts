import { AppError } from '../../errors/app-error.js';
import type { IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';

export class ListPendingProductSuggestionsUseCase {
  constructor(private suggestions: IProductSuggestionRepository, private stocks: Pick<IStockRepository, 'findByIdForUser'>) {}

  async execute({ stockId, userId }: { stockId: string; userId: string }) {
    const stock = await this.stocks.findByIdForUser(stockId, userId);
    if (!stock) throw new AppError('Acesso não autorizado ao estoque informado.', 403);
    return this.suggestions.findPendingByStockId(stockId);
  }
}
