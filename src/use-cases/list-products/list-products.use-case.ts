import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';

interface IListProductsRequest {
  userId: string;
  stockId?: string | undefined;
  companyId?: string | undefined;
}

export class ListProductsUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({ userId, stockId, companyId }: IListProductsRequest): Promise<IProduct[]> {
    if (stockId) {
      return this.productRepository.findByStockId(stockId, userId);
    }

    if (companyId) {
      return this.productRepository.findByCompanyId(companyId, userId);
    }

    return this.productRepository.findByUserId(userId);
  }
}
