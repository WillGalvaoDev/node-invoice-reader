export interface IProduct {
  id?: string;
  code: string;
  description: string;
  quantity: number;
  unitMeasurement: string;
  unitPrice: number;
  totalPrice: number;
  createdAt?: Date;
}

export interface IProductRepository {
  save(product: IProduct): Promise<IProduct>;
  findByCode(code: string): Promise<IProduct | null>;
}