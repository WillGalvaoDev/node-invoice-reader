import { AppError } from '../../errors/app-error.js';
import { SimilarityUnavailableError } from '../../errors/similarity-unavailable.error.js';
import { logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { prefilterSimilarityCandidates } from './similarity-candidate-prefilter.js';
import { randomUUID } from 'node:crypto';
import { parseCnpj } from '../../domain/cnpj.js';
import { assertDanfeCoherence } from '../../domain/danfe-coherence.js';
import { aiTelemetry, recordAiTelemetryBestEffort } from '../../infra/ai-telemetry.js';
export class ReadInvoiceUseCase {
    storageProvider;
    aiProvider;
    productRepository;
    auditLogRepository;
    stockRepository;
    invoicePersistenceRepository;
    applicationLogger;
    telemetry;
    constructor(storageProvider, aiProvider, productRepository, auditLogRepository, stockRepository, invoicePersistenceRepository, applicationLogger = logger, telemetry = aiTelemetry) {
        this.storageProvider = storageProvider;
        this.aiProvider = aiProvider;
        this.productRepository = productRepository;
        this.auditLogRepository = auditLogRepository;
        this.stockRepository = stockRepository;
        this.invoicePersistenceRepository = invoicePersistenceRepository;
        this.applicationLogger = applicationLogger;
        this.telemetry = telemetry;
    }
    sanitizeString(input) {
        return input
            .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    findSimilarProduct(description, candidates, requestId) {
        return requestId
            ? this.aiProvider.findSimilarProduct(description, candidates, { requestId })
            : this.aiProvider.findSimilarProduct(description, candidates);
    }
    productAuditState(product) {
        return {
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            totalPrice: product.totalPrice,
        };
    }
    async execute({ filePath, mimeType, stockId, userId, requestId }) {
        try {
            const authorizedStock = userId
                ? await this.stockRepository.findByIdForUser(stockId, userId)
                : null;
            if (!authorizedStock) {
                const requestedStock = await this.stockRepository.findById(stockId);
                await persistAuditBestEffort({
                    repository: this.auditLogRepository,
                    logger: this.applicationLogger,
                    requestId,
                    log: {
                        action: 'UNAUTHORIZED_ACCESS',
                        entity: 'INVOICE',
                        description: 'Tentativa de acesso não autorizado ao estoque.',
                        ...(userId && { userId }),
                        ...(requestedStock && { stockId: requestedStock.id, companyId: requestedStock.companyId }),
                    },
                });
                throw new AppError('Acesso não autorizado ao estoque informado.', 403);
            }
            // 1. Extrai os dados da nota fiscal via Gemini OCR
            const fileContent = await this.storageProvider.readFile(filePath);
            const rawExtractedData = requestId
                ? await this.aiProvider.extractDanfeData(fileContent, mimeType, { requestId })
                : await this.aiProvider.extractDanfeData(fileContent, mimeType);
            let supplierCnpj;
            try {
                supplierCnpj = parseCnpj(rawExtractedData.supplier.cnpj);
            }
            catch {
                throw new AppError('O DANFE contém um CNPJ inválido.', 422);
            }
            const extractedData = {
                ...rawExtractedData,
                supplier: { ...rawExtractedData.supplier, cnpj: supplierCnpj },
            };
            if (!extractedData || !extractedData.products || extractedData.products.length === 0) {
                throw new AppError('Falha ao extrair produtos do DANFE. Nenhum item válido encontrado.', 400);
            }
            if (!/^\d{44}$/.test(extractedData.accessKey)) {
                throw new AppError('Chave de acesso da NF-e inválida.', 422);
            }
            const hasInvalidNumbers = extractedData.products.some((p) => Number(p.quantity) <= 0 || Number(p.unitPrice) <= 0 || Number(p.totalPrice) <= 0);
            if (hasInvalidNumbers) {
                throw new AppError('Os produtos do DANFE contêm valores ou quantidades inválidas.', 400);
            }
            assertDanfeCoherence(extractedData);
            const processedProducts = [];
            const suggestions = [];
            const operations = [];
            const suggestionOperations = [];
            const existingStockProducts = await this.productRepository.findByStockId(stockId);
            const auditStateByProductCode = new Map(existingStockProducts.map((product) => [product.code, product]));
            for (const [itemIndex, rawItem] of extractedData.products.entries()) {
                const item = {
                    ...rawItem,
                    description: this.sanitizeString(rawItem.description),
                };
                const existingByCode = existingStockProducts.find((product) => product.code === item.code)
                    ?? await this.productRepository.findByCode(item.code, stockId);
                if (existingByCode) {
                    if (!auditStateByProductCode.has(item.code)) {
                        auditStateByProductCode.set(item.code, existingByCode);
                    }
                    operations.push({
                        product: {
                            ...existingByCode,
                            description: item.description,
                            quantity: Number(item.quantity),
                            unitPrice: Number(item.unitPrice),
                            totalPrice: Number(item.totalPrice),
                        },
                    });
                    continue;
                }
                const candidates = prefilterSimilarityCandidates(item.description, stockId, existingStockProducts);
                const similarity = candidates.length > 0
                    ? await this.findSimilarProduct(item.description, candidates, requestId)
                    : { kind: 'no_match' };
                // Indisponibilidade não é evidência de item novo. Abortar aqui — antes da
                // transação — não persiste nada e não consome a chave de idempotência,
                // então a mesma nota pode ser reenviada quando o provedor voltar.
                if (similarity.kind === 'unavailable') {
                    this.applicationLogger.warn('Invoice aborted: similarity matching unavailable', {
                        ...(requestId && { requestId }),
                        companyId: authorizedStock.companyId,
                        stockId,
                        itemIndex,
                        reason: similarity.reason,
                    });
                    throw new SimilarityUnavailableError(similarity.reason);
                }
                if (similarity.kind === 'match') {
                    const suggestionId = randomUUID();
                    suggestions.push({
                        id: suggestionId,
                        status: 'PENDING',
                        invoiceItem: item,
                        suggestedProduct: similarity.product,
                        confidence: similarity.confidence,
                        reason: similarity.reason,
                    });
                    suggestionOperations.push({
                        id: suggestionId,
                        itemIndex,
                        suggestedProductId: similarity.product.id,
                        receivedCode: item.code,
                        receivedDescription: item.description,
                        receivedQuantity: Number(item.quantity),
                        receivedUnitPrice: Number(item.unitPrice),
                        unitMeasurement: item.unitMeasurement,
                        confidence: similarity.confidence,
                        reason: similarity.reason,
                    });
                    continue;
                }
                const newProductId = randomUUID();
                const newProduct = {
                    id: newProductId,
                    code: item.code,
                    description: item.description,
                    quantity: Number(item.quantity),
                    unitMeasurement: item.unitMeasurement,
                    unitPrice: Number(item.unitPrice),
                    totalPrice: Number(item.totalPrice),
                    stockId,
                    userId: userId ?? null,
                };
                operations.push({
                    product: newProduct,
                });
                existingStockProducts.push(newProduct);
            }
            processedProducts.push(...await this.invoicePersistenceRepository.persist({
                accessKey: extractedData.accessKey,
                stockId,
                operations,
                suggestions: suggestionOperations,
            }));
            for (const suggestion of suggestions) {
                recordAiTelemetryBestEffort(() => this.telemetry.recordSuggestion({ decision: 'created', confidence: suggestion.confidence }), this.applicationLogger, { event: 'ai_suggestion', decision: 'created', ...(requestId && { requestId }) });
            }
            await persistAuditBestEffort({
                repository: this.auditLogRepository,
                logger: this.applicationLogger,
                requestId,
                log: {
                    action: 'CREATE',
                    entity: 'INVOICE',
                    entityId: extractedData.accessKey,
                    description: 'Invoice processada com sucesso.',
                    ...(userId && { userId }),
                    companyId: authorizedStock.companyId,
                    stockId,
                    previousState: null,
                    newState: {
                        processedProductCount: operations.length,
                        pendingSuggestionCount: suggestions.length,
                    },
                },
            });
            for (const [index, operation] of operations.entries()) {
                const persistedProduct = processedProducts[index];
                if (!persistedProduct?.id)
                    continue;
                const previousProduct = auditStateByProductCode.get(operation.product.code);
                await persistAuditBestEffort({
                    repository: this.auditLogRepository,
                    logger: this.applicationLogger,
                    requestId,
                    log: {
                        action: previousProduct ? 'UPDATE' : 'CREATE',
                        entity: 'PRODUCT',
                        entityId: persistedProduct.id,
                        description: 'Entrada de estoque processada por invoice.',
                        ...(userId && { userId }),
                        companyId: authorizedStock.companyId,
                        stockId,
                        previousState: previousProduct ? this.productAuditState(previousProduct) : null,
                        newState: this.productAuditState(persistedProduct),
                    },
                });
                auditStateByProductCode.set(operation.product.code, persistedProduct);
            }
            return {
                extractedData,
                processedProducts,
                suggestions,
            };
        }
        finally {
            try {
                await this.storageProvider.deleteFile(filePath);
            }
            catch (error) {
                this.applicationLogger.warn('Temporary file cleanup failed', {
                    ...(requestId && { requestId }),
                    error: { name: error instanceof Error ? error.name : 'UnknownError' },
                });
            }
        }
    }
}
//# sourceMappingURL=read-invoice.use-case.js.map