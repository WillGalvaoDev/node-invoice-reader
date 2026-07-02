import { type IStorageProvider } from '../../providers/storage.provider.js';

export class ReadInvoiceUseCase {
  // Aqui aplicamos a Inversão de Dependência:
  // O caso de uso exige QUALQUER provedor de storage, desde que siga o contrato.
  constructor(private storageProvider: IStorageProvider) {}

  async execute(filePath: string): Promise<string> {
    console.log(`[UseCase] Starting invoice read process for path: ${filePath}`);

    if (!filePath || filePath.trim() === '') {
    throw new Error("File path is required");
  }
    
    const rawData = await this.storageProvider.readFile(filePath);
    
    // No futuro, o próximo passo da IA vai entrar bem aqui!
    // rawData -> passar para o AIProvider
    
    return rawData;
  }
}