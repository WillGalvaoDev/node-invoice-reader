import type { IProduct } from './product.repository.js';

export interface IInvoiceProductOperation {
  product: IProduct;
}

export interface IInvoicePersistencePlan {
  accessKey: string;
  stockId: string;
  operations: IInvoiceProductOperation[];
}

export interface IInvoicePersistenceRepository {
  persist(plan: IInvoicePersistencePlan): Promise<IProduct[]>;
}
