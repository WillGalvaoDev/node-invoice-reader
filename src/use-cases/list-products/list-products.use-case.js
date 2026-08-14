import { AppError } from '../../errors/app-error.js';
export class ListProductsUseCase {
    productRepository;
    stockRepository;
    constructor(productRepository, stockRepository) {
        this.productRepository = productRepository;
        this.stockRepository = stockRepository;
    }
    async execute({ userId, stockId, limit, cursor }) {
        const stock = await this.stockRepository.findByIdForViewer(stockId, userId);
        if (!stock)
            throw new AppError('Acesso não autorizado ao estoque informado.', 403);
        if (cursor) {
            const cursorProduct = await this.productRepository.findById(cursor);
            if (!cursorProduct || cursorProduct.stockId !== stockId)
                throw new AppError('Cursor de produto inválido.', 400);
        }
        return this.productRepository.findPageByStockId({ stockId, limit, cursor });
    }
}
//# sourceMappingURL=list-products.use-case.js.map