import type { Request, Response } from 'express';
import type { ListCompanyStocksUseCase } from '../use-cases/list-company-stocks/list-company-stocks.use-case.js';
import { AppError } from '../errors/app-error.js';
import { listCompanyStocksQuerySchema } from '../schemas/http.schemas.js';

export class ListCompanyStocksController {
  constructor(private listCompanyStocksUseCase: ListCompanyStocksUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    const userId = request.user?.id;

    if (!userId) {
      throw new AppError('Usuário não autenticado.', 401);
    }

    const { companyId } = request.params as { companyId: string };
    const { limit, cursor } = listCompanyStocksQuerySchema.parse(request.query);

    const page = await this.listCompanyStocksUseCase.execute({
      userId,
      companyId,
      limit,
      cursor,
      requestId: request.requestId,
    });

    return response.status(200).json({
      status: 'success',
      data: {
        items: page.items,
        nextCursor: page.nextCursor,
      },
    });
  }
}
