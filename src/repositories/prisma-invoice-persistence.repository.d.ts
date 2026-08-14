import type { IInvoicePersistencePlan, IInvoicePersistenceRepository } from './invoice-persistence.repository.js';
import type { IProduct } from './product.repository.js';
export declare class PrismaInvoicePersistenceRepository implements IInvoicePersistenceRepository {
    persist({ accessKey, stockId, operations, suggestions }: IInvoicePersistencePlan): Promise<IProduct[]>;
}
//# sourceMappingURL=prisma-invoice-persistence.repository.d.ts.map