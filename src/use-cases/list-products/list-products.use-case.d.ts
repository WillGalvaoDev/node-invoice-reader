import type { IProductPage, IProductRepository } from '../../repositories/product.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
interface IListProductsRequest {
    userId: string;
    stockId: string;
    limit: number;
    cursor?: string | undefined;
}
export declare class ListProductsUseCase {
    private productRepository;
    private stockRepository;
    constructor(productRepository: IProductRepository, stockRepository: Pick<IStockRepository, 'findByIdForViewer'>);
    execute({ userId, stockId, limit, cursor }: IListProductsRequest): Promise<IProductPage>;
}
export {};
//# sourceMappingURL=list-products.use-case.d.ts.map