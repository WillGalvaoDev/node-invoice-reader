import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult, ISimilarityMatch } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { AppError } from '../../errors/app-error.js';
import type { IInvoicePersistenceRepository, IInvoiceProductOperation } from '../../repositories/invoice-persistence.repository.js';
import type { DanfeMimeType } from '../../config/upload.js';
import { logger, type Logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { prefilterSimilarityCandidates } from './similarity-candidate-prefilter.js';
import { randomUUID } from 'node:crypto';
import type { IInvoiceSuggestionOperation } from '../../repositories/invoice-persistence.repository.js';
import { parseCnpj } from '../../domain/cnpj.js';
import { assertDanfeCoherence } from '../../domain/danfe-coherence.js';

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
  ) {}

  private sanitizeString(input: string): string {
    return input
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private productAuditState(product: IProduct) {
    return {
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      totalPrice: product.totalPrice,
    };
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
      const rawExtractedData = await this.aiProvider.extractDanfeData(filePath, mimeType);

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
        const similarityMatch: ISimilarityMatch | null = candidates.length > 0
          ? await this.aiProvider.findSimilarProduct(item.description, candidates)
          : null;

        if (similarityMatch?.product.id) {
          const suggestionId = randomUUID();
          suggestions.push({
            id: suggestionId,
            status: 'PENDING',
            invoiceItem: item,
            suggestedProduct: similarityMatch.product,
            confidence: similarityMatch.confidence,
            reason: similarityMatch.reason,
          });
          suggestionOperations.push({
            id: suggestionId,
            itemIndex,
            suggestedProductId: similarityMatch.product.id,
            receivedCode: item.code,
            receivedDescription: item.description,
            receivedQuantity: Number(item.quantity),
            receivedUnitPrice: Number(item.unitPrice),
            unitMeasurement: item.unitMeasurement,
            confidence: similarityMatch.confidence,
            reason: similarityMatch.reason,
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
        if (!persistedProduct?.id) continue;
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
