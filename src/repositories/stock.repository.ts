export interface IStock {
  id?: string;
  name: string;
  companyId: string;
  createdAt?: Date;
}

export interface IStockRepository {
  create(stock: IStock): Promise<IStock>;
  findById(id: string): Promise<IStock | null>;
  findByCompanyId(companyId: string): Promise<IStock[]>;
}