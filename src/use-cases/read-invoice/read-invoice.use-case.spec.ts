import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
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
    // Adicionamos o deleteFile para suprir a limpeza de arquivo temporário no Use Case
    storageProviderMock = {
      readFile: vi.fn(),
      deleteFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as Mocked<IStorageProvider>;

    aiProviderMock = {
      extractDanfeData: vi.fn().mockResolvedValue(mockAiResult)
    } as unknown as Mocked<IAiProvider>;

    productRepositoryMock = {
      save: vi.fn().mockImplementation((product: IProduct) => Promise.resolve({ id: 'any-id', ...product })),
      findByCode: vi.fn().mockResolvedValue(null),
      findByUserId: vi.fn().mockResolvedValue([])
    } as unknown as Mocked<IProductRepository>;

    sut = new ReadInvoiceUseCase(storageProviderMock, aiProviderMock, productRepositoryMock);
  });

  it('should extract data via AI using the file path and save all products to the repository', async () => {
    const filePath = '/path/to/any/nota.png';
    const userId = 'user-any-id';
    
    // Passamos o DTO correto com o filePath e o userId
    const result = await sut.execute({ filePath, userId });

    // 1. Garante que acionou a IA passando o caminho do arquivo direto
    expect(aiProviderMock.extractDanfeData).toHaveBeenCalledWith(filePath);
    
    // 2. Garante que o método save do repositório foi chamado com as propriedades do produto e o userId atrelado
    expect(productRepositoryMock.save).toHaveBeenCalledTimes(2);
    expect(productRepositoryMock.save).toHaveBeenNthCalledWith(1, {
      ...mockAiResult.products[0],
      userId
    });
    expect(productRepositoryMock.save).toHaveBeenNthCalledWith(2, {
      ...mockAiResult.products[1],
      userId
    });

    // 3. Retorno final do use case continua íntegro
    expect(result.invoiceNumber).toBe('000542');
  });
});