import type { IStock } from './stock.repository.js';

export interface ICompany {
  id?: string;
  name: string;
  cnpj: string;
  ownerId: string;
  createdAt?: Date;
}

export interface ICompanyPageQuery {
  userId: string;
  limit: number;
  cursor?: string | undefined;
}

export interface ICompanyPage {
  items: ICompany[];
  nextCursor: string | null;
}

export interface ICompanyRepository {
  create(company: ICompany): Promise<ICompany>;
  // Atômico: se a criação do estoque falhar, a empresa não deve persistir.
  createWithDefaultStock(company: ICompany, defaultStockName: string): Promise<{ company: ICompany; stock: IStock }>;
  findById(id: string): Promise<ICompany | null>;
  // Owner tem acesso implícito; colaborador precisa de CompanyCollaborator (P1-01).
  findAccessibleById(id: string, userId: string): Promise<ICompany | null>;
  findAccessiblePageByUserId(query: ICompanyPageQuery): Promise<ICompanyPage>;
  findByCnpj(cnpj: string): Promise<ICompany | null>; // 👈 Adicionado
}