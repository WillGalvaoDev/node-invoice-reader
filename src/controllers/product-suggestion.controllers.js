import { AppError } from '../errors/app-error.js';
function authenticatedUserId(request) {
    const userId = request.user?.id;
    if (!userId)
        throw new AppError('Usuário não autenticado.', 401);
    return userId;
}
function routeParam(request, name) {
    const value = request.params[name];
    if (typeof value !== 'string')
        throw new AppError('Dados inválidos.', 400);
    return value;
}
export class ConfirmProductSuggestionController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const suggestion = await this.useCase.execute({
            suggestionId: routeParam(request, 'suggestionId'), userId: authenticatedUserId(request),
        });
        return response.status(200).json({ status: 'success', data: { suggestion } });
    }
}
export class RejectProductSuggestionController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const suggestion = await this.useCase.execute({
            suggestionId: routeParam(request, 'suggestionId'), userId: authenticatedUserId(request),
        });
        return response.status(200).json({ status: 'success', data: { suggestion } });
    }
}
export class ListPendingProductSuggestionsController {
    useCase;
    constructor(useCase) {
        this.useCase = useCase;
    }
    async handle(request, response) {
        const suggestions = await this.useCase.execute({
            stockId: routeParam(request, 'stockId'), userId: authenticatedUserId(request),
        });
        return response.status(200).json({ status: 'success', data: { suggestions } });
    }
}
//# sourceMappingURL=product-suggestion.controllers.js.map