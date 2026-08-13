import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import type { IInvoicePersistenceRepository } from '../../repositories/invoice-persistence.repository.js';
import type { DanfeMimeType } from '../../config/upload.js';
import { type Logger } from '../../infra/logger.js';
interface IReadInvoiceRequest {
    filePath: string;
    mimeType: DanfeMimeType;
    stockId: string;
    userId?: string | undefined;
    requestId?: string | undefined;
}
export interface IProductSuggestion {
    id: string;
    status: 'PENDING';
    invoiceItem: IDanfeExtractResult['products'][number];
    suggestedProduct: IProduct;
    confidence: number;
    reason: string;
}
export interface IReadInvoiceResponse {
    extractedData: IDanfeExtractResult;
    processedProducts: IProduct[];
    suggestions: IProductSuggestion[];
}
export declare class ReadInvoiceUseCase {
    private readonly storageProvider;
    private readonly aiProvider;
    private readonly productRepository;
    private readonly auditLogRepository;
    private readonly stockRepository;
    private readonly invoicePersistenceRepository;
    private readonly applicationLogger;
    constructor(storageProvider: IStorageProvider, aiProvider: IAiProvider, productRepository: IProductRepository, auditLogRepository: IAuditLogRepository, stockRepository: IStockRepository, invoicePersistenceRepository: IInvoicePersistenceRepository, applicationLogger?: Logger);
    private sanitizeString;
    private productAuditState;
    execute({ filePath, mimeType, stockId, userId, requestId }: IReadInvoiceRequest): Promise<IReadInvoiceResponse>;
}
export {};
//# sourceMappingURL=read-invoice.use-case.d.ts.map