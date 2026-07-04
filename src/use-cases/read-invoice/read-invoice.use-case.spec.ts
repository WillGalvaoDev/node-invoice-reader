import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest'; // Importamos o tipo utilitário explicitamente
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';

describe('ReadInvoiceUseCase', () => {
  let storageProviderMock: Mocked<IStorageProvider>;
  let aiProviderMock: Mocked<IAiProvider>;
  let productRepositoryMock: Mocked<IProductRepository>;
  let sut: ReadInvoiceUseCase;

  const mockAiResult: IDanfeExtractResult = {
    accessKey: '35260700000000000000550010000000011000000001',
    invoiceNumber: '000542',
    series: '2',
    issuedAt: new Date('2026-07-02'),
    totalValue: 350.00,
    supplier: {
      cnpj: '12345678000199',
      name: 'METALURGICA DO MEIER LTDA',
      stateRegistration: '987654321'
    },
    products: [
      {
        code: '0982',
        description: 'PARAF SEXTAVADO 1/4 X 2',
        quantity: 50,
        unitMeasurement: 'UN',
        unitPrice: 2.50,
        totalPrice: 125.00
      },
      {
        code: '1045',
        description: 'CHAVE PHILIPS ACCO PRO',
        quantity: 5,
        unitMeasurement: 'CX',
        unitPrice: 45.00,
        totalPrice: 225.00
      }
    ]
  };

  beforeEach(() => {
    storageProviderMock = {
      readFile: vi.fn().mockResolvedValue('texto bruto da nota fiscal') // Alterado de readTextFile para readFile
    };

    aiProviderMock = {
      extractDanfeData: vi.fn().mockResolvedValue(mockAiResult)
    };

    // Criamos o mock do nosso novo repositório de produtos
    productRepositoryMock = {
      save: vi.fn().mockImplementation((product: IProduct) => Promise.resolve({ id: 'any-id', ...product })),
      findByCode: vi.fn().mockResolvedValue(null)
    };

    // Injetamos o terceiro elemento no construtor (o TS vai chiar aqui até ajustarmos o use case)
    sut = new ReadInvoiceUseCase(storageProviderMock, aiProviderMock, productRepositoryMock);
  });

  it('should read the invoice file, extract data via AI, and save all products to the repository', async () => {
    const filePath = '/path/to/any/nota.txt';
    
    const result = await sut.execute(filePath);

    // 1. Garante que leu o arquivo e acionou a IA corretamente
    expect(storageProviderMock.readFile).toHaveBeenCalledWith(filePath); // Alterado aqui também
    expect(aiProviderMock.extractDanfeData).toHaveBeenCalledWith('texto bruto da nota fiscal');
    
    // 2. Garante que o método save do repositório foi chamado para CADA produto da nota
    expect(productRepositoryMock.save).toHaveBeenCalledTimes(2);
    expect(productRepositoryMock.save).toHaveBeenNthCalledWith(1, mockAiResult.products[0]);
    expect(productRepositoryMock.save).toHaveBeenNthCalledWith(2, mockAiResult.products[1]);

    // 3. Retorno final do use case continua íntegro
    expect(result.invoiceNumber).toBe('000542');
  });
});