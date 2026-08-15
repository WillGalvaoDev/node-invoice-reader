import type { IStock, IStockPage, IStockPageQuery, IStockRepository } from '../stock.repository.js';

export class InMemoryStockRepository implements IStockRepository {
  public items: IStock[] = [];
  public createAuthorizedUserIds = new Map<string, Set<string>>();
  public viewAuthorizedUserIds = new Map<string, Set<string>>();
  // companyId -> ownerId. Owner é viewer implícito, independente de qualquer
  // entrada em viewAuthorizedUserIds — mesma invariante da query Prisma real (P1-02).
  public companyOwnerId = new Map<string, string>();

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

  private isViewable(stock: IStock, userId: string): boolean {
    if (this.companyOwnerId.get(stock.companyId) === userId) return true;
    return this.viewAuthorizedUserIds.get(stock.id as string)?.has(userId) ?? false;
  }

  async findByIdForViewer(id: string, userId: string): Promise<IStock | null> {
    const stock = this.items.find((item) => item.id === id);
    if (!stock || !this.isViewable(stock, userId)) return null;
    return stock;
  }

  async findViewablePageByCompanyId({ companyId, userId, limit, cursor }: IStockPageQuery): Promise<IStockPage> {
    const ordered = this.items
      .filter((item) => item.companyId === companyId && this.isViewable(item, userId))
      .sort((left, right) => {
        const byCreatedAt = (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0);
        return byCreatedAt || (right.id ?? '').localeCompare(left.id ?? '');
      });
    const cursorIndex = cursor ? ordered.findIndex((item) => item.id === cursor) : -1;
    const pageWithExtra = ordered.slice(cursorIndex + 1, cursorIndex + 1 + limit + 1);
    const items = pageWithExtra.slice(0, limit);
    return { items, nextCursor: pageWithExtra.length > limit ? items.at(-1)?.id ?? null : null };
  }
}
