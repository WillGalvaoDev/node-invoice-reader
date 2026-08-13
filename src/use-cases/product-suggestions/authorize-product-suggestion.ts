import { AppError } from '../../errors/app-error.js';
import type { IProductSimilaritySuggestion, IProductSuggestionRepository } from '../../repositories/product-suggestion.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';

export async function authorizeProductSuggestion(
  suggestionId: string,
  userId: string,
  suggestions: IProductSuggestionRepository,
  stocks: Pick<IStockRepository, 'findByIdForUser'>,
): Promise<IProductSimilaritySuggestion> {
  const suggestion = await suggestions.findById(suggestionId);
  if (!suggestion) throw new AppError('Sugestão não encontrada.', 404);

  const stock = await stocks.findByIdForUser(suggestion.stockId, userId);
  if (!stock) throw new AppError('Acesso não autorizado à sugestão.', 403);
  return suggestion;
}
