import type { IProduct, IProductPage, IProductPageQuery, IProductRepository } from '../product.repository.js';
export declare class InMemoryProductRepository implements IProductRepository {
    items: IProduct[];
    save(product: IProduct): Promise<IProduct>;
    findByCode(code: string, stockId: string): Promise<IProduct | null>;
    findByStockId(stockId: string): Promise<IProduct[]>;
    findPageByStockId({ stockId, limit, cursor }: IProductPageQuery): Promise<IProductPage>;
    findById(id: string): Promise<IProduct | null>;
    update(id: string, data: Partial<IProduct>): Promise<IProduct>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=in-memory-product.repository.d.ts.map