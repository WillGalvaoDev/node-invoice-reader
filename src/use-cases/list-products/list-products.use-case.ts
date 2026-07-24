import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';

interface IListProductsRequest {
  userId: string;
  stockId?: string | undefined;
  companyId?: string | undefined;
}

export class ListProductsUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({ userId, stockId, companyId }: IListProductsRequest): Promise<IProduct[]> {
    console.log('🔍 [ListProductsUseCase] Recebido para execução:', { userId, stockId, companyId });

    if (stockId) {
      console.log('➡️ [ListProductsUseCase] Entrando na busca por stockId...');
      return this.productRepository.findByStockId(stockId, userId);
    }

    if (companyId) {
      console.log('➡️ [ListProductsUseCase] Entrando na busca por companyId...');
      return this.productRepository.findByCompanyId(companyId, userId);
    }

    console.log('➡️ [ListProductsUseCase] Entrando na busca padrao por userId...');
    return this.productRepository.findByUserId(userId);
  }
}