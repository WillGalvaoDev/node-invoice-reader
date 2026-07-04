import type { IProductRepository, IProduct } from './product.repository.js';

export class InMemoryProductRepository implements IProductRepository {
  private products: IProduct[] = [];

  async save(product: IProduct): Promise<IProduct> {
    const newProduct = {
      id: Math.random().toString(36).substring(7),
      ...product,
      createdAt: new Date()
    };
    this.products.push(newProduct);
    console.log(`💾 [Banco de Dados] Produto salvo com sucesso: ${newProduct.description} (ID: ${newProduct.id})`);
    return newProduct;
  }

  async findByCode(code: string): Promise<IProduct | null> {
    const product = this.products.find(p => p.code === code);
    return product || null;
  }
}