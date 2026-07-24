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

export interface IProductRepository {
  save(product: IProduct): Promise<IProduct>;
  findByCode(code: string, stockId: string): Promise<IProduct | null>;
  findByUserId(userId: string): Promise<IProduct[]>;
  findByStockId(stockId: string, userId?: string): Promise<IProduct[]>; // 👈 Recebe userId opcional para trava
  findByCompanyId(companyId: string, userId?: string): Promise<IProduct[]>; // 👈 Recebe userId opcional para trava
  findById(id: string): Promise<IProduct | null>;
  update(id: string, data: Partial<IProduct>): Promise<IProduct>;
  delete(id: string): Promise<void>;
}