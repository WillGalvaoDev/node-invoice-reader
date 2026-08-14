import type { IStock, IStockRepository } from '../stock.repository.js';

export class InMemoryStockRepository implements IStockRepository {
  public items: IStock[] = [];
  public createAuthorizedUserIds = new Map<string, Set<string>>();
  public viewAuthorizedUserIds = new Map<string, Set<string>>();

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

  async findByIdForUser(id: string, userId: string): Promise<IStock | null> {
    const authorizedUsers = this.createAuthorizedUserIds.get(id);
    if (!authorizedUsers?.has(userId)) return null;
    return this.findById(id);
  }

  async findByIdForViewer(id: string, userId: string): Promise<IStock | null> {
    const authorizedUsers = this.viewAuthorizedUserIds.get(id);
    if (!authorizedUsers?.has(userId)) return null;
    return this.findById(id);
  }

  async findByCompanyId(companyId: string): Promise<IStock[]> {
    return this.items.filter((item) => item.companyId === companyId);
  }
}
