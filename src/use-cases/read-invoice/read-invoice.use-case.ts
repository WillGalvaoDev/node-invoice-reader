import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult, ISimilarityMatch } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';

interface IReadInvoiceRequest {
  filePath: string;
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
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  async execute({ filePath, stockId, userId, companyId }: IReadInvoiceRequest): Promise<IReadInvoiceResponse> {
    try {
      // 1. Extrai os dados da nota fiscal via Gemini OCR
      const extractedData = await this.aiProvider.extractDanfeData(filePath);

      const processedProducts: IProduct[] = [];
      const suggestions: IProductSuggestion[] = [];

      if (extractedData.products && extractedData.products.length > 0) {
        // Carrega produtos existentes deste estoque uma única vez para otimizar as buscas por IA
        const existingStockProducts = await this.productRepository.findByStockId(stockId);

        for (const item of extractedData.products) {
          // CAMADA 1: Busca exata pelo código dentro do mesmo estoque
          const existingByCode = await this.productRepository.findByCode(item.code, stockId);

          if (existingByCode && existingByCode.id) {
            // Upsert: soma a quantidade e atualiza os preços
            const updatedProduct = await this.productRepository.update(existingByCode.id, {
              quantity: existingByCode.quantity + item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              description: item.description,
            });
            processedProducts.push(updatedProduct);
            continue;
          }

          // CAMADA 2: Similaridade semântica via IA com produtos do mesmo estoque
          const similarityMatch: ISimilarityMatch | null =
            await this.aiProvider.findSimilarProduct(item.description, existingStockProducts);

          if (similarityMatch) {
            // Guarda para sugestão do usuário no Front-end
            suggestions.push({
              invoiceItem: item,
              suggestedProduct: similarityMatch.product,
              confidence: similarityMatch.confidence,
              reason: similarityMatch.reason,
            });
            continue;
          }

          // CAMADA 3: Não encontrou match nem por código nem por IA -> Cria novo produto
         const newProduct = await this.productRepository.save({
  code: item.code,
  description: item.description,
  quantity: Number(item.quantity),
  unitMeasurement: item.unitMeasurement,
  unitPrice: Number(item.unitPrice),
  totalPrice: Number(item.totalPrice),
  stockId,
  userId: userId ?? null, // 👈 Trata undefined de forma determinística
});

          processedProducts.push(newProduct);
        }
      }

      // 2. Grava o Log de Auditoria
      await this.auditLogRepository.create({
        action: 'CREATE',
        entity: 'INVOICE',
        entityId: extractedData.accessKey || extractedData.invoiceNumber,
        details: `Nota Fiscal nº ${extractedData.invoiceNumber} lida. ${processedProducts.length} produtos processados, ${suggestions.length} sugestões pendentes.`,
        ...(userId && { userId }),
        ...(companyId && { companyId }),
      });

      return {
        extractedData,
        processedProducts,
        suggestions,
      };
    } finally {
      // Remoção garantida do arquivo temporário
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