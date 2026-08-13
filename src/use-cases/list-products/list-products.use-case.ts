import type { IProductPage, IProductRepository } from '../../repositories/product.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { AppError } from '../../errors/app-error.js';

interface IListProductsRequest {
  userId: string;
  stockId: string;
  limit: number;
  cursor?: string | undefined;
}

export class ListProductsUseCase {
  constructor(
    private productRepository: IProductRepository,
    private stockRepository: Pick<IStockRepository, 'findByIdForViewer'>,
  ) {}

  async execute({ userId, stockId, limit, cursor }: IListProductsRequest): Promise<IProductPage> {
    const stock = await this.stockRepository.findByIdForViewer(stockId, userId);
    if (!stock) throw new AppError('Acesso não autorizado ao estoque informado.', 403);
    if (cursor) {
      const cursorProduct = await this.productRepository.findById(cursor);
      if (!cursorProduct || cursorProduct.stockId !== stockId) throw new AppError('Cursor de produto inválido.', 400);
    }
    return this.productRepository.findPageByStockId({ stockId, limit, cursor });
  }
}
