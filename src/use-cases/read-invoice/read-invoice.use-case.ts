import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository } from '../../repositories/product.repository.js';

// 1. Interface para o DTO de entrada do Use Case
interface IReadInvoiceRequest {
  filePath: string;
  userId?: string | undefined; // Opcional para não quebrar compatibilidades legadas
}

export class ReadInvoiceUseCase {
  constructor(
    private readonly storageProvider: IStorageProvider,
    private readonly aiProvider: IAiProvider,
    private readonly productRepository: IProductRepository // Injeção do repositório de produtos
  ) {}

  // 2. Desestruturamos o objeto recebido no parâmetro do método execute
  async execute({ filePath, userId }: IReadInvoiceRequest): Promise<IDanfeExtractResult> {
  // Você pode comentar ou remover a linha do storageProvider se o foco for 100% multimidia
  // const rawText = await this.storageProvider.readFile(filePath);

  // Passa o caminho do arquivo direto para o AI Provider resolver a leitura e a visão computacional
  const extractedData = await this.aiProvider.extractDanfeData(filePath);

    // 3. Loop sequencial simples para persistir cada produto extraído no banco de dados
    for (const product of extractedData.products) {
      await this.productRepository.save({
        code: product.code,
        description: product.description,
        quantity: product.quantity,
        unitMeasurement: product.unitMeasurement,
        unitPrice: product.unitPrice,
        totalPrice: product.totalPrice,
        userId, // 3. <-- Repassamos o userId para o repositório salvar atrelado ao produto
      });
    }

    // 4. Retorna o resultado consolidado da nota
    return extractedData;
  }
}