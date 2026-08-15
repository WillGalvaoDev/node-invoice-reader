import type { ICompany, ICompanyPage, ICompanyPageQuery, ICompanyRepository } from '../company.repository.js';
import type { IStock } from '../stock.repository.js';

export class InMemoryCompanyRepository implements ICompanyRepository {
  public items: ICompany[] = [];
  public stocks: IStock[] = [];
  public failNextStockCreation = false;
  // companyId -> Set<userId>, mesmo padrão de InMemoryStockRepository.viewAuthorizedUserIds.
  public collaboratorUserIds = new Map<string, Set<string>>();

  async create(company: ICompany): Promise<ICompany> {
    const newCompany = {
      id: company.id ?? `company-${this.items.length + 1}`,
      name: company.name,
      cnpj: company.cnpj ?? null,
      ownerId: company.ownerId,
      createdAt: company.createdAt ?? new Date(),
    } as ICompany;

    this.items.push(newCompany);
    return newCompany;
  }

  async createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{ company: ICompany; stock: IStock }> {
    if (this.failNextStockCreation) {
      this.failNextStockCreation = false;
      throw new Error('Simulated stock creation failure');
    }

    const newCompany: ICompany = {
      id: company.id ?? `company-${this.items.length + 1}`,
      name: company.name,
      cnpj: company.cnpj,
      ownerId: company.ownerId,
      createdAt: company.createdAt ?? new Date(),
    };
    const newStock: IStock = {
      id: `stock-${this.stocks.length + 1}`,
      name: defaultStockName,
      companyId: newCompany.id as string,
      createdAt: new Date(),
    };

    this.items.push(newCompany);
    this.stocks.push(newStock);
    return { company: newCompany, stock: newStock };
  }

  async findById(id: string): Promise<ICompany | null> {
    const company = this.items.find((item) => item.id === id);
    return company ?? null;
  }

  private hasAccess(company: ICompany, userId: string): boolean {
    if (company.ownerId === userId) return true;
    return this.collaboratorUserIds.get(company.id as string)?.has(userId) ?? false;
  }

  async findAccessibleById(id: string, userId: string): Promise<ICompany | null> {
    const company = this.items.find((item) => item.id === id);
    if (!company || !this.hasAccess(company, userId)) return null;
    return company;
  }

  async findAccessiblePageByUserId({ userId, limit, cursor }: ICompanyPageQuery): Promise<ICompanyPage> {
    const ordered = this.items.filter((item) => this.hasAccess(item, userId)).sort((left, right) => {
      const byCreatedAt = (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0);
      return byCreatedAt || (right.id ?? '').localeCompare(left.id ?? '');
    });
    const cursorIndex = cursor ? ordered.findIndex((item) => item.id === cursor) : -1;
    const pageWithExtra = ordered.slice(cursorIndex + 1, cursorIndex + 1 + limit + 1);
    const items = pageWithExtra.slice(0, limit);
    return { items, nextCursor: pageWithExtra.length > limit ? items.at(-1)?.id ?? null : null };
  }

  // 👈 Método adicionado:
  async findByCnpj(cnpj: string): Promise<ICompany | null> {
    const company = this.items.find((item) => item.cnpj === cnpj);
    return company ?? null;
  }
}