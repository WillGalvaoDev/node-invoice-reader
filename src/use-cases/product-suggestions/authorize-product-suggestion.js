import { AppError } from '../../errors/app-error.js';
export async function authorizeProductSuggestion(suggestionId, userId, suggestions, stocks) {
    const suggestion = await suggestions.findById(suggestionId);
    if (!suggestion)
        throw new AppError('Sugestão não encontrada.', 404);
    const stock = await stocks.findByIdForUser(suggestion.stockId, userId);
    if (!stock)
        throw new AppError('Acesso não autorizado à sugestão.', 403);
    return { suggestion, companyId: stock.companyId };
}
//# sourceMappingURL=authorize-product-suggestion.js.map