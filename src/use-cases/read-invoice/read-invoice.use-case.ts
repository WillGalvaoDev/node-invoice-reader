import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository } from '../../repositories/product.repository.js';

export class ReadInvoiceUseCase {
  constructor(
    private readonly storageProvider: IStorageProvider,
    private readonly aiProvider: IAiProvider,
    private readonly productRepository: IProductRepository // Injeção do repositório de produtos
  ) {}

  async execute(filePath: string): Promise<IDanfeExtractResult> {
    // 1. Lê o arquivo bruto através do storage provider
    const rawText = await this.storageProvider.readFile(filePath);

    // 2. Passa o texto para a Inteligência Artificial extrair os dados estruturados
    const extractedData = await this.aiProvider.extractDanfeData(rawText);

    // 3. Loop sequencial simples para persistir cada produto extraído no banco de dados
    for (const product of extractedData.products) {
      await this.productRepository.save({
        code: product.code,
        description: product.description,
        quantity: product.quantity,
        unitMeasurement: product.unitMeasurement,
        unitPrice: product.unitPrice,
        totalPrice: product.totalPrice,
      });
    }

    // 4. Retorna o resultado consolidado da nota
    return extractedData;
  }
}