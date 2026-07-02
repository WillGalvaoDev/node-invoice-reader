import { describe, it, expect } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';

// Dublê do Leitor de Arquivos
class MockStorageProvider implements IStorageProvider {
  async readFile(path: string): Promise<string> {
    return "DANFE TEXT FROM FILE";
  }
}

// Dublê da Inteligência Artificial
class MockAiProvider implements IAiProvider {
  async extractDanfeData(rawText: string): Promise<IDanfeExtractResult> {
    return {
      accessKey: "35260700000000000000550010000000011000000001",
      invoiceNumber: "000001",
      series: "1",
      issuedAt: new Date("2026-07-02"),
      totalValue: 1500.00,
      supplier: {
        cnpj: "00.000.000/0001-00",
        name: "FORNECEDOR DE TESTE LTDA",
        stateRegistration: "123456789"
      },
      products: [
        {
          code: "PRD001",
          description: "PARAF SEXT 1/4",
          quantity: 100,
          unitPrice: 5.00,
          totalPrice: 500.00,
          unitMeasurement: "UN"
        }
      ]
    };
  }
}

describe('ReadInvoiceUseCase', () => {
  it('should be able to read and extract DANFE data successfully', async () => {
    // Arrange
    const mockStorageProvider = new MockStorageProvider();
    const mockAiProvider = new MockAiProvider();
    const sut = new ReadInvoiceUseCase(mockStorageProvider, mockAiProvider); 

    // Act
    const result = await sut.execute('../nota.txt');

    // Assert
    expect(result.accessKey).toBe("35260700000000000000550010000000011000000001");
    
    // Validamos o tamanho do array para garantir boas práticas no teste
    expect(result.products).toHaveLength(1); 
    
    // Uso do Encadeamento Opcional (?.) para satisfazer as regras estritas do TypeScript
    expect(result.products?.[0]?.code).toBe("PRD001");
    expect(result.supplier.name).toBe("FORNECEDOR DE TESTE LTDA");
  });

  it('should throw an error if the file path is empty', async () => {
    const mockStorageProvider = new MockStorageProvider();
    const mockAiProvider = new MockAiProvider();
    const sut = new ReadInvoiceUseCase(mockStorageProvider, mockAiProvider);

    await expect(sut.execute('')).rejects.toThrow("File path is required");
  });
});