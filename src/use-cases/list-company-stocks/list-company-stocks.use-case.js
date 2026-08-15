import { AppError } from '../../errors/app-error.js';
import { logger } from '../../infra/logger.js';
const COMPANY_NOT_FOUND_MESSAGE = 'Empresa não encontrada.';
export class ListCompanyStocksUseCase {
    companyRepository;
    stockRepository;
    applicationLogger;
    constructor(companyRepository, stockRepository, applicationLogger = logger) {
        this.companyRepository = companyRepository;
        this.stockRepository = stockRepository;
        this.applicationLogger = applicationLogger;
    }
    async execute({ userId, companyId, limit, cursor, requestId }) {
        // Gate de existência/acesso à empresa (P1-01) — deliberadamente independente da
        // pergunta "quais estoques", que tem sua própria regra mais estrita abaixo.
        const company = await this.companyRepository.findAccessibleById(companyId, userId);
        if (!company) {
            this.applicationLogger.warn('Unauthorized company stocks discovery attempt', {
                ...(requestId && { requestId }),
                userId,
                companyId,
            });
            throw new AppError(COMPANY_NOT_FOUND_MESSAGE, 404);
        }
        if (cursor) {
            const cursorStock = await this.stockRepository.findByIdForViewer(cursor, userId);
            if (!cursorStock || cursorStock.companyId !== companyId) {
                throw new AppError('Cursor de estoque inválido.', 400);
            }
        }
        const page = await this.stockRepository.findViewablePageByCompanyId({ companyId, userId, limit, cursor });
        return {
            items: page.items.map((stock) => this.toViewableStock(stock)),
            nextCursor: page.nextCursor,
        };
    }
    toViewableStock(stock) {
        return {
            id: stock.id,
            name: stock.name,
            createdAt: stock.createdAt,
        };
    }
}
//# sourceMappingURL=list-company-stocks.use-case.js.map