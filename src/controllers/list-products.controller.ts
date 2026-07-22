import type { Request, Response } from 'express';
import type { ListProductsUseCase } from '../use-cases/list-products/list-products.use-case.ts';
import { AppError } from '../errors/app-error.js';

export class ListProductsController {
  constructor(private listProductsUseCase: ListProductsUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    const userId = request.user?.id;

    if (!userId) {
      throw new AppError('Usuário não autenticado.', 401);
    }

    const products = await this.listProductsUseCase.execute({ userId });

    return response.status(200).json({
      status: 'success',
      data: {
        products,
      },
    });
  }
}