import type { IProduct, IProductRepository } from '../product.repository.js';

export class InMemoryProductRepository implements IProductRepository {
  public items: IProduct[] = [];

  async save(product: IProduct): Promise<IProduct> {
    const newProduct: IProduct = {
      id: product.id ?? 'product-1',
      code: product.code,
      description: product.description,
      quantity: product.quantity,
      unitMeasurement: product.unitMeasurement,
      unitPrice: product.unitPrice,
      totalPrice: product.totalPrice,
      userId: product.userId,
      createdAt: product.createdAt ?? new Date(),
    };

    this.items.push(newProduct);
    return newProduct;
  }

  async findByCode(code: string): Promise<IProduct | null> {
    const product = this.items.find((item) => item.code === code);
    return product ?? null;
  }

  async findByUserId(userId: string): Promise<IProduct[]> {
    return this.items.filter((item) => item.userId === userId);
  }
}