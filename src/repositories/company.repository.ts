export interface ICompany {
  id?: string;
  name: string;
  cnpj: string;
  ownerId: string;
  createdAt?: Date;
}

export interface ICompanyRepository {
  create(company: ICompany): Promise<ICompany>;
  findById(id: string): Promise<ICompany | null>;
  findByOwnerId(ownerId: string): Promise<ICompany[]>;
  findByCnpj(cnpj: string): Promise<ICompany | null>; // 👈 Adicionado
}