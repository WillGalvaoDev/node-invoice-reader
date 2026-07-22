export interface IProduct {
  id?: string;
  code: string;
  description: string;
  quantity: number;
  unitMeasurement: string;
  unitPrice: number;
  totalPrice: number;
  stockId: string; // 👈 Novo campo obrigatório pelo Prisma Schema
  userId?: string | null | undefined;
  createdAt?: Date;
}

export interface IProductRepository {
  save(product: IProduct): Promise<IProduct>;
  findByCode(code: string, stockId: string): Promise<IProduct | null>; // 👈 Agora busca por código dentro de um estoque
  findByUserId(userId: string): Promise<IProduct[]>;
  findByStockId(stockId: string): Promise<IProduct[]>;
  findById(id: string): Promise<IProduct | null>;
  update(id: string, data: Partial<IProduct>): Promise<IProduct>; // 👈 Para edição/upsert
  delete(id: string): Promise<void>; // 👈 Para exclusão
}