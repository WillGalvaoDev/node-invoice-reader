import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult, ISimilarityMatch } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';
import { AppError } from '../../errors/app-error.js';
import type { IInvoicePersistenceRepository, IInvoiceProductOperation } from '../../repositories/invoice-persistence.repository.js';
import type { DanfeMimeType } from '../../config/upload.js';

interface IReadInvoiceRequest {
  filePath: string;
  mimeType: DanfeMimeType;
  stockId: string;
  userId?: string | undefined;
  companyId?: string | undefined;
}

export interface IProductSuggestion {
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
    private readonly invoicePersistenceRepository: IInvoicePersistenceRepository
  ) {}

  private sanitizeString(input: string): string {
    return input
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async execute({ filePath, mimeType, stockId, userId, companyId }: IReadInvoiceRequest): Promise<IReadInvoiceResponse> {
    try {
      const authorizedStock = userId
        ? await this.stockRepository.findByIdForUser(stockId, userId)
        : null;

      if (!authorizedStock) {
        await this.auditLogRepository.create({
          action: 'UNAUTHORIZED_ACCESS',
          entity: 'INVOICE',
          details: `Tentativa de acesso negada ao estoque: ${stockId}`,
          ...(userId && { userId }),
        });

        throw new AppError('Acesso não autorizado ao estoque informado.', 403);
      }

      // 1. Extrai os dados da nota fiscal via Gemini OCR
      const extractedData = await this.aiProvider.extractDanfeData(filePath, mimeType);

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

      const processedProducts: IProduct[] = [];
      const suggestions: IProductSuggestion[] = [];
      const operations: IInvoiceProductOperation[] = [];

      const existingStockProducts = await this.productRepository.findByStockId(stockId);

      for (const rawItem of extractedData.products) {
        const item = {
          ...rawItem,
          description: this.sanitizeString(rawItem.description),
        };

        const existingByCode = await this.productRepository.findByCode(item.code, stockId);

        if (existingByCode) {
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

        const similarityMatch: ISimilarityMatch | null =
          await this.aiProvider.findSimilarProduct(item.description, existingStockProducts);

        if (similarityMatch) {
          suggestions.push({
            invoiceItem: item,
            suggestedProduct: similarityMatch.product,
            confidence: similarityMatch.confidence,
            reason: similarityMatch.reason,
          });
          continue;
        }

        operations.push({
          product: {
            code: item.code,
            description: item.description,
            quantity: Number(item.quantity),
            unitMeasurement: item.unitMeasurement,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            stockId,
            userId: userId ?? null,
          },
        });
      }

      processedProducts.push(...await this.invoicePersistenceRepository.persist({
        accessKey: extractedData.accessKey,
        stockId,
        operations,
        auditLog: {
          action: 'CREATE',
          entity: 'INVOICE',
          entityId: extractedData.accessKey,
          details: `Nota Fiscal nº ${extractedData.invoiceNumber} lida. ${operations.length} produtos processados, ${suggestions.length} sugestões pendentes.`,
          ...(userId && { userId }),
          ...(companyId && { companyId }),
        },
      }));

      return {
        extractedData,
        processedProducts,
        suggestions,
      };
    } finally {
      console.log(`[Use Case] Tentando deletar arquivo em: ${filePath}`);
      try {
        await this.storageProvider.deleteFile(filePath);
        console.log(`[Storage] Arquivo temporário removido: ${filePath}`);
      } catch (error) {
        console.error(`[Storage] Erro ao deletar arquivo temporário: ${filePath}`, error);
      }
    }
  }
}
