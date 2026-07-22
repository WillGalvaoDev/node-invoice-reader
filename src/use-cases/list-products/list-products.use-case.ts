import type { IProductRepository } from '../../repositories/product.repository.js';

interface IListProductsRequest {
  userId: string;
}

export class ListProductsUseCase {
  constructor(private productRepository: IProductRepository) {}

  async execute({ userId }: IListProductsRequest) {
    // Busca todos os produtos vinculados ao ID do usuário autenticado
    const products = await this.productRepository.findByUserId(userId);
    return products;
  }
}