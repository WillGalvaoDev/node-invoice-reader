// src/use-cases/read-invoice/read-invoice.use-case.spec.ts
import { describe, it, expect } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import type { IStorageProvider } from '../../providers/storage.provider.js';

// 1. Criamos um "Mock" (um dublê de testes) do nosso StorageProvider
// Isso evita que o teste acesse o HD real do seu computador
class MockStorageProvider implements IStorageProvider {
  async readFile(path: string): Promise<string> {
    return "DANFE RAW TEXT CONTENT";
  }
}

describe('ReadInvoiceUseCase', () => {
  it('should be able to read an invoice file content successfully', async () => {
    // Arrange (Preparar as peças)
    const mockStorageProvider = new MockStorageProvider();
    const sut = new ReadInvoiceUseCase(mockStorageProvider); 
    // SUT = System Under Test (Convenção de mercado para a classe principal sendo testada)

    // Act (Executar a ação do caso de uso)
    const result = await sut.execute('../nota.txt');

    // Assert (Verificar se o resultado foi o esperado)
    expect(result).toBe("DANFE RAW TEXT CONTENT");
  });

  it('should throw an error if the file path is empty', async () => {
    const mockStorageProvider = new MockStorageProvider();
    const sut = new ReadInvoiceUseCase(mockStorageProvider);

    // O teste espera que essa promessa seja rejeitada com um erro específico
    await expect(sut.execute('')).rejects.toThrow("File path is required");
  });
});