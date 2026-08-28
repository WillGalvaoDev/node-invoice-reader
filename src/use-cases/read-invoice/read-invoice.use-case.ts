import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult, ISimilarityResult } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { AppError } from '../../errors/app-error.js';
import { SimilarityUnavailableError } from '../../errors/similarity-unavailable.error.js';
import type { IInvoicePersistenceRepository, IInvoiceProductOperation } from '../../repositories/invoice-persistence.repository.js';
import type { DanfeMimeType } from '../../config/upload.js';
import { logger, type Logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { auditEvents } from '../audit-events.js';
import { prefilterSimilarityCandidates } from './similarity-candidate-prefilter.js';
import { randomUUID } from 'node:crypto';
import type { IInvoiceSuggestionOperation } from '../../repositories/invoice-persistence.repository.js';
import { parseCnpj } from '../../domain/cnpj.js';
import { assertDanfeCoherence } from '../../domain/danfe-coherence.js';
import { aiTelemetry, recordAiTelemetryBestEffort, type IAiTelemetry } from '../../infra/ai-telemetry.js';

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

export class ReadInvoiceUseCase {
  constructor(
    private readonly storageProvider: IStorageProvider,
    private readonly aiProvider: IAiProvider,
    private readonly productRepository: IProductRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly stockRepository: IStockRepository,
    private readonly invoicePersistenceRepository: IInvoicePersistenceRepository,
    private readonly applicationLogger: Logger = logger,
    private readonly telemetry: IAiTelemetry = aiTelemetry,
  ) {}

  private sanitizeString(input: string): string {
    return input
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findSimilarProduct(
    description: string,
    candidates: IProduct[],
    requestId?: string | undefined,
  ): Promise<ISimilarityResult> {
    return requestId
      ? this.aiProvider.findSimilarProduct(description, candidates, { requestId })
      : this.aiProvider.findSimilarProduct(description, candidates);
  }

  async execute({ filePath, mimeType, stockId, userId, requestId }: IReadInvoiceRequest): Promise<IReadInvoiceResponse> {
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
          log: auditEvents.invoiceUnauthorizedAccess({
            ...(userId && { userId }),
            ...(requestedStock && { stockId: requestedStock.id, companyId: requestedStock.companyId }),
          }),
        });

        throw new AppError('Acesso não autorizado ao estoque informado.', 403);
      }

      // 1. Extrai os dados da nota fiscal via Gemini OCR
      const fileContent = await this.storageProvider.readFile(filePath);
      const rawExtractedData = requestId
        ? await this.aiProvider.extractDanfeData(fileContent, mimeType, { requestId })
        : await this.aiProvider.extractDanfeData(fileContent, mimeType);

      let supplierCnpj: string;
      try {
        supplierCnpj = parseCnpj(rawExtractedData.supplier.cnpj);
      } catch {
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

      const hasInvalidNumbers = extractedData.products.some(
        (p) => Number(p.quantity) <= 0 || Number(p.unitPrice) <= 0 || Number(p.totalPrice) <= 0
      );

      if (hasInvalidNumbers) {
        throw new AppError('Os produtos do DANFE contêm valores ou quantidades inválidas.', 400);
      }

      assertDanfeCoherence(extractedData);

      const processedProducts: IProduct[] = [];
      const suggestions: IProductSuggestion[] = [];
      const operations: IInvoiceProductOperation[] = [];
      const suggestionOperations: IInvoiceSuggestionOperation[] = [];

      const existingStockProducts = await this.productRepository.findByStockId(stockId);
      const auditStateByProductCode = new Map(
        existingStockProducts.map((product) => [product.code, product] as const),
      );

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
        const similarity: ISimilarityResult = candidates.length > 0
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
        const newProduct: IProduct = {
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
        recordAiTelemetryBestEffort(
          () => this.telemetry.recordSuggestion({ decision: 'created', confidence: suggestion.confidence }),
          this.applicationLogger,
          { event: 'ai_suggestion', decision: 'created', ...(requestId && { requestId }) },
        );
      }

      await persistAuditBestEffort({
        repository: this.auditLogRepository,
        logger: this.applicationLogger,
        requestId,
        log: auditEvents.invoiceProcessed({
          ...(userId && { userId }),
          companyId: authorizedStock.companyId,
          stockId,
          accessKey: extractedData.accessKey,
          processedProductCount: operations.length,
          pendingSuggestionCount: suggestions.length,
        }),
      });

      for (const [index, operation] of operations.entries()) {
        const persistedProduct = processedProducts[index];
        if (!persistedProduct?.id) continue;
        const previousProduct = auditStateByProductCode.get(operation.product.code);

        await persistAuditBestEffort({
          repository: this.auditLogRepository,
          logger: this.applicationLogger,
          requestId,
          log: auditEvents.productEntry({
            ...(userId && { userId }),
            companyId: authorizedStock.companyId,
            stockId,
            productId: persistedProduct.id,
            previous: previousProduct ?? null,
            next: persistedProduct,
          }),
        });

        auditStateByProductCode.set(operation.product.code, persistedProduct);
      }

      return {
        extractedData,
        processedProducts,
        suggestions,
      };
    } finally {
      try {
        await this.storageProvider.deleteFile(filePath);
      } catch (error) {
        this.applicationLogger.warn('Temporary file cleanup failed', {
          ...(requestId && { requestId }),
          error: { name: error instanceof Error ? error.name : 'UnknownError' },
        });
      }
    }
  }
}
