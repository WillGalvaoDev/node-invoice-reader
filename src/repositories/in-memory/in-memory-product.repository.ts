import type { IProduct, IProductRepository } from '../product.repository.js';

export class InMemoryProductRepository implements IProductRepository {
  public items: IProduct[] = [];

  async save(product: IProduct): Promise<IProduct> {
    const newProduct: IProduct = {
      id: product.id ?? `product-${this.items.length + 1}`,
      code: product.code,
      ean: product.ean ?? null,
      ncm: product.ncm ?? null,
      description: product.description,
      quantity: product.quantity,
      unitMeasurement: product.unitMeasurement,
      unitPrice: product.unitPrice,
      totalPrice: product.totalPrice,
      stockId: product.stockId,
      userId: product.userId ?? null,
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

  async findByStockId(stockId: string, userId?: string): Promise<IProduct[]> {
    return this.items.filter((item) => {
      const matchesStock = item.stockId === stockId;
      const matchesUser = userId ? item.userId === userId : true;
      return matchesStock && matchesUser;
    });
  }

  async findByCompanyId(companyId: string, userId?: string): Promise<IProduct[]> {
    return this.items.filter((item) => {
      // Em memória, mantemos a verificação do usuário caso informado
      const matchesUser = userId ? item.userId === userId : true;
      return matchesUser;
    });
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