import type { Request, Response } from 'express';
import type { ConfirmProductSuggestionUseCase } from '../use-cases/product-suggestions/confirm-product-suggestion.use-case.js';
import type { RejectProductSuggestionUseCase } from '../use-cases/product-suggestions/reject-product-suggestion.use-case.js';
import type { ListPendingProductSuggestionsUseCase } from '../use-cases/product-suggestions/list-pending-product-suggestions.use-case.js';
export declare class ConfirmProductSuggestionController {
    private useCase;
    constructor(useCase: ConfirmProductSuggestionUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class RejectProductSuggestionController {
    private useCase;
    constructor(useCase: RejectProductSuggestionUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class ListPendingProductSuggestionsController {
    private useCase;
    constructor(useCase: ListPendingProductSuggestionsUseCase);
    handle(request: Request, response: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=product-suggestion.controllers.d.ts.map