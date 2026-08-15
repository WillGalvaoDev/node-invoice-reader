import type { ICompanyRepository } from '../../repositories/company.repository.js';
import type { IStock, IStockRepository } from '../../repositories/stock.repository.js';
import { AppError } from '../../errors/app-error.js';
import { logger, type Logger } from '../../infra/logger.js';

export interface IViewableStock {
  id: string;
  name: string;
  createdAt: Date;
}

export interface IViewableStockPage {
  items: IViewableStock[];
  nextCursor: string | null;
}

interface IListCompanyStocksRequest {
  userId: string;
  companyId: string;
  limit: number;
  cursor?: string | undefined;
  requestId?: string | undefined;
}

const COMPANY_NOT_FOUND_MESSAGE = 'Empresa não encontrada.';

export class ListCompanyStocksUseCase {
  constructor(
    private readonly companyRepository: Pick<ICompanyRepository, 'findAccessibleById'>,
    private readonly stockRepository: Pick<IStockRepository, 'findByIdForViewer' | 'findViewablePageByCompanyId'>,
    private readonly applicationLogger: Logger = logger,
  ) {}

  async execute({ userId, companyId, limit, cursor, requestId }: IListCompanyStocksRequest): Promise<IViewableStockPage> {
    // Gate de existência/acesso à empresa (P1-01) — deliberadamente independente da
    // pergunta "quais estoques", que tem sua própria regra mais estrita abaixo.
    const company = await this.companyRepository.findAccessibleById(companyId, userId);
    if (!company) {
      this.applicationLogger.warn('Unauthorized company stocks discovery attempt', {
        ...(requestId && { requestId }),
        userId,
        companyId,
      });
      throw new AppError(COMPANY_NOT_FOUND_MESSAGE, 404);
    }

    if (cursor) {
      const cursorStock = await this.stockRepository.findByIdForViewer(cursor, userId);
      if (!cursorStock || cursorStock.companyId !== companyId) {
        throw new AppError('Cursor de estoque inválido.', 400);
      }
    }

    const page = await this.stockRepository.findViewablePageByCompanyId({ companyId, userId, limit, cursor });

    return {
      items: page.items.map((stock) => this.toViewableStock(stock)),
      nextCursor: page.nextCursor,
    };
  }

  private toViewableStock(stock: IStock): IViewableStock {
    return {
      id: stock.id as string,
      name: stock.name,
      createdAt: stock.createdAt as Date,
    };
  }
}
