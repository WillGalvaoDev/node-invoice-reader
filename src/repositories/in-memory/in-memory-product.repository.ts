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
      stockId: product.stockId, // ✅ Adicionado
      userId: product.userId,
      createdAt: product.createdAt ?? new Date(),
    };

    this.items.push(newProduct);
    return newProduct;
  }

  async findByCode(code: string, stockId: string): Promise<IProduct | null> {
    const product = this.items.find(
      (item) => item.code === code && item.stockId === stockId
    );
    return product ?? null;
  }

  async findByUserId(userId: string): Promise<IProduct[]> {
    return this.items.filter((item) => item.userId === userId);
  }

  async findByStockId(stockId: string): Promise<IProduct[]> {
    return this.items.filter((item) => item.stockId === stockId);
  }

  async findById(id: string): Promise<IProduct | null> {
    const product = this.items.find((item) => item.id === id);
    return product ?? null;
  }

  async update(id: string, data: Partial<IProduct>): Promise<IProduct> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('Product not found');

    const updatedProduct = {
      ...this.items[index],
      ...data,
    } as IProduct;

    this.items[index] = updatedProduct;
    return updatedProduct;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
  }
}