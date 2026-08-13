import type { IProductRepository, IProduct, IProductPage, IProductPageQuery } from './product.repository.js';
export declare class PrismaProductRepository implements IProductRepository {
    save(product: IProduct): Promise<IProduct>;
    findByCode(code: string, stockId: string): Promise<IProduct | null>;
    findByStockId(stockId: string): Promise<IProduct[]>;
    findPageByStockId({ stockId, limit, cursor }: IProductPageQuery): Promise<IProductPage>;
    findById(id: string): Promise<IProduct | null>;
    update(id: string, data: Partial<IProduct>): Promise<IProduct>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=prisma-product.repository.d.ts.map