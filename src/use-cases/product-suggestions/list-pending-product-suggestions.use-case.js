import { AppError } from '../../errors/app-error.js';
export class ListPendingProductSuggestionsUseCase {
    suggestions;
    stocks;
    constructor(suggestions, stocks) {
        this.suggestions = suggestions;
        this.stocks = stocks;
    }
    async execute({ stockId, userId }) {
        const stock = await this.stocks.findByIdForUser(stockId, userId);
        if (!stock)
            throw new AppError('Acesso não autorizado ao estoque informado.', 403);
        return this.suggestions.findPendingByStockId(stockId);
    }
}
//# sourceMappingURL=list-pending-product-suggestions.use-case.js.map