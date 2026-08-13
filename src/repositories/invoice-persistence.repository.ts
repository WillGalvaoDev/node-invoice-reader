import type { IAuditLog } from './audit-log.repository.js';
import type { IProduct } from './product.repository.js';

export interface IInvoiceProductOperation {
  product: IProduct;
}

export interface IInvoicePersistencePlan {
  accessKey: string;
  stockId: string;
  operations: IInvoiceProductOperation[];
  auditLog: IAuditLog;
}

export interface IInvoicePersistenceRepository {
  persist(plan: IInvoicePersistencePlan): Promise<IProduct[]>;
}
