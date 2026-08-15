import type { Request, Response } from 'express';
import type { ListCompaniesUseCase } from '../use-cases/list-companies/list-companies.use-case.js';
import { AppError } from '../errors/app-error.js';
import { listCompaniesQuerySchema } from '../schemas/http.schemas.js';

export class ListCompaniesController {
  constructor(private listCompaniesUseCase: ListCompaniesUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    const userId = request.user?.id;

    if (!userId) {
      throw new AppError('Usuário não autenticado.', 401);
    }

    const { limit, cursor } = listCompaniesQuerySchema.parse(request.query);

    const page = await this.listCompaniesUseCase.execute({ userId, limit, cursor });

    return response.status(200).json({
      status: 'success',
      data: {
        items: page.items,
        nextCursor: page.nextCursor,
      },
    });
  }
}
