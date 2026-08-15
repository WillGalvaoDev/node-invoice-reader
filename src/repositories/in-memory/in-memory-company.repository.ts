import type { ICompany, ICompanyRepository } from '../company.repository.js';
import type { IStock } from '../stock.repository.js';

export class InMemoryCompanyRepository implements ICompanyRepository {
  public items: ICompany[] = [];
  public stocks: IStock[] = [];
  public failNextStockCreation = false;

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

  async findByOwnerId(ownerId: string): Promise<ICompany[]> {
    return this.items.filter((item) => item.ownerId === ownerId);
  }

  // 👈 Método adicionado:
  async findByCnpj(cnpj: string): Promise<ICompany | null> {
    const company = this.items.find((item) => item.cnpj === cnpj);
    return company ?? null;
  }
}