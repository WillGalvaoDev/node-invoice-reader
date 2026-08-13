import type { Request, Response } from 'express';
import type { ListProductsUseCase } from '../use-cases/list-products/list-products.use-case.ts';
import { AppError } from '../errors/app-error.js';
import { listProductsQuerySchema } from '../schemas/http.schemas.js';

export class ListProductsController {
  constructor(private listProductsUseCase: ListProductsUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    const userId = request.user?.id;

    if (!userId) {
      throw new AppError('Usuário não autenticado.', 401);
    }

    const { stockId, companyId } = listProductsQuerySchema.parse(request.query);

    const products = await this.listProductsUseCase.execute({
      userId,
      stockId,
      companyId,
    });

    return response.status(200).json({
      status: 'success',
      data: {
        products,
      },
    });
  }
}
