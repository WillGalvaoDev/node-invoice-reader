import { authorizeProductSuggestion } from './authorize-product-suggestion.js';
export class RejectProductSuggestionUseCase {
    suggestions;
    stocks;
    constructor(suggestions, stocks) {
        this.suggestions = suggestions;
        this.stocks = stocks;
    }
    async execute({ suggestionId, userId }) {
        await authorizeProductSuggestion(suggestionId, userId, this.suggestions, this.stocks);
        return this.suggestions.reject(suggestionId, userId);
    }
}
//# sourceMappingURL=reject-product-suggestion.use-case.js.map