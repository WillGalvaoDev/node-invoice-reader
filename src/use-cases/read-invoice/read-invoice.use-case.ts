import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';

export class ReadInvoiceUseCase {
  constructor(
    private storageProvider: IStorageProvider,
    private aiProvider: IAiProvider // 1. Injetamos a nova tomada da IA aqui
  ) {}

  // 2. Agora o método não devolve mais uma string pura, devolve o DANFE estruturado!
  async execute(filePath: string): Promise<IDanfeExtractResult> {
    if (!filePath || filePath.trim() === '') {
      throw new Error("File path is required");
    }

    // Passo 1: Busca o texto bruto do arquivo usando o Storage
    const rawText = await this.storageProvider.readFile(filePath);
    
    // Passo 2: Passa o texto bruto para a inteligência artificial processar
    const danfeData = await this.aiProvider.extractDanfeData(rawText);
    
    // Passo 3: Retorna os dados prontos para o estoque
    return danfeData;
  }
}