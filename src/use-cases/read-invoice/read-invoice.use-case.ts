import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository } from '../../repositories/product.repository.js';

interface IReadInvoiceRequest {
  filePath: string;
  userId?: string | undefined;
}

export class ReadInvoiceUseCase {
  constructor(
    private readonly storageProvider: IStorageProvider,
    private readonly aiProvider: IAiProvider,
    private readonly productRepository: IProductRepository
  ) {}

  async execute({ filePath, userId }: IReadInvoiceRequest): Promise<IDanfeExtractResult> {
    // 1. Passa o caminho do arquivo direto para o Gemini AI Provider extrair os dados da imagem
    const extractedData = await this.aiProvider.extractDanfeData(filePath);

    // 2. Valida se existem produtos antes de rodar o loop (evita quebrar se a IA falhar na listagem)
    if (extractedData.products && extractedData.products.length > 0) {
      // Usamos Promise.all para salvar todos em paralelo, deixando a execução muito mais rápida
      const savePromises = extractedData.products.map(product =>
        this.productRepository.save({
          code: product.code,
          description: product.description,
          quantity: product.quantity,
          unitMeasurement: product.unitMeasurement,
          unitPrice: product.unitPrice,
          totalPrice: product.totalPrice,
          userId, // Armazena o ID do usuário (ou null caso não venha no request)
        })
      );

      await Promise.all(savePromises);
    }

    // 3. Retorna o resultado consolidado da nota para o controller
    return extractedData;
  }
}