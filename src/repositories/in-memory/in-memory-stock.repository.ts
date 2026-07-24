import type { IStock, IStockRepository } from '../stock.repository.js';

export class InMemoryStockRepository implements IStockRepository {
  public items: IStock[] = [];

  async create(stock: IStock): Promise<IStock> {
    const newStock = {
      id: stock.id ?? `stock-${this.items.length + 1}`,
      name: stock.name,
      companyId: stock.companyId,
      createdAt: stock.createdAt ?? new Date(),
    } as IStock;

    this.items.push(newStock);
    return newStock;
  }

  async findById(id: string): Promise<IStock | null> {
    const stock = this.items.find((item) => item.id === id);
    return stock ?? null;
  }

  async findByCompanyId(companyId: string): Promise<IStock[]> {
    return this.items.filter((item) => item.companyId === companyId);
  }
}