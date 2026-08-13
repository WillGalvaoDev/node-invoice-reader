export interface IProduct {
  id?: string;
  code: string;
  ean?: string | null;
  ncm?: string | null;
  description: string;
  quantity: number;
  unitMeasurement: string;
  unitPrice: number;
  totalPrice: number;
  stockId: string;
  userId?: string | null;
  createdAt?: Date;
}

export interface IProductPageQuery {
  stockId: string;
  limit: number;
  cursor?: string | undefined;
}

export interface IProductPage {
  items: IProduct[];
  nextCursor: string | null;
}

export interface IProductRepository {
  save(product: IProduct): Promise<IProduct>;
  findByCode(code: string, stockId: string): Promise<IProduct | null>;
  findByStockId(stockId: string): Promise<IProduct[]>;
  findPageByStockId(query: IProductPageQuery): Promise<IProductPage>;
  findById(id: string): Promise<IProduct | null>;
  update(id: string, data: Partial<IProduct>): Promise<IProduct>;
  delete(id: string): Promise<void>;
}
