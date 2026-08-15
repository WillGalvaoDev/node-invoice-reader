export interface IStock {
  id?: string;
  name: string;
  companyId: string;
  createdAt?: Date;
}

export interface IStockPageQuery {
  companyId: string;
  userId: string;
  limit: number;
  cursor?: string | undefined;
}

export interface IStockPage {
  items: IStock[];
  nextCursor: string | null;
}

export interface IStockRepository {
  create(stock: IStock): Promise<IStock>;
  findById(id: string): Promise<IStock | null>;
  findByIdForUser(id: string, userId: string): Promise<IStock | null>;
  findByIdForViewer(id: string, userId: string): Promise<IStock | null>;
  // Owner vê todos; colaborador só os estoques com StockPermission.canView (P1-02).
  findViewablePageByCompanyId(query: IStockPageQuery): Promise<IStockPage>;
}
