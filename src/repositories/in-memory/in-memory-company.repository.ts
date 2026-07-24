import type { ICompany, ICompanyRepository } from '../company.repository.js';

export class InMemoryCompanyRepository implements ICompanyRepository {
  public items: ICompany[] = [];

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