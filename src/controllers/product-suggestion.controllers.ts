import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import type { ConfirmProductSuggestionUseCase } from '../use-cases/product-suggestions/confirm-product-suggestion.use-case.js';
import type { RejectProductSuggestionUseCase } from '../use-cases/product-suggestions/reject-product-suggestion.use-case.js';
import type { ListPendingProductSuggestionsUseCase } from '../use-cases/product-suggestions/list-pending-product-suggestions.use-case.js';

function authenticatedUserId(request: Request): string {
  const userId = request.user?.id;
  if (!userId) throw new AppError('Usuário não autenticado.', 401);
  return userId;
}

function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string') throw new AppError('Dados inválidos.', 400);
  return value;
}

export class ConfirmProductSuggestionController {
  constructor(private useCase: ConfirmProductSuggestionUseCase) {}
  async handle(request: Request, response: Response) {
    const suggestion = await this.useCase.execute({
      suggestionId: routeParam(request, 'suggestionId'), userId: authenticatedUserId(request),
    });
    return response.status(200).json({ status: 'success', data: { suggestion } });
  }
}

export class RejectProductSuggestionController {
  constructor(private useCase: RejectProductSuggestionUseCase) {}
  async handle(request: Request, response: Response) {
    const suggestion = await this.useCase.execute({
      suggestionId: routeParam(request, 'suggestionId'), userId: authenticatedUserId(request),
    });
    return response.status(200).json({ status: 'success', data: { suggestion } });
  }
}

export class ListPendingProductSuggestionsController {
  constructor(private useCase: ListPendingProductSuggestionsUseCase) {}
  async handle(request: Request, response: Response) {
    const suggestions = await this.useCase.execute({
      stockId: routeParam(request, 'stockId'), userId: authenticatedUserId(request),
    });
    return response.status(200).json({ status: 'success', data: { suggestions } });
  }
}
