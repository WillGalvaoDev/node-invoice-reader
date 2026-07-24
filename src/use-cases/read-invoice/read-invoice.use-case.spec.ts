import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';

describe('ReadInvoiceUseCase', () => {
  let storageProviderMock: Mocked<IStorageProvider>;
  let aiProviderMock: Mocked<IAiProvider>;
  let productRepositoryMock: Mocked<IProductRepository>;
  let auditLogRepositoryMock: Mocked<IAuditLogRepository>;
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
      readFile: vi.fn(),
      deleteFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as Mocked<IStorageProvider>;

    aiProviderMock = {
      extractDanfeData: vi.fn().mockResolvedValue(mockAiResult),
      findSimilarProduct: vi.fn().mockResolvedValue(null)
    } as unknown as Mocked<IAiProvider>;

    productRepositoryMock = {
      save: vi.fn().mockImplementation((product: IProduct) => Promise.resolve({ id: 'new-id', ...product })),
      findByCode: vi.fn().mockResolvedValue(null),
      findByUserId: vi.fn().mockResolvedValue([]),
      findByStockId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation((id: string, data: Partial<IProduct>) => Promise.resolve({ id, ...data } as IProduct)),
      delete: vi.fn().mockResolvedValue(undefined)
    } as unknown as Mocked<IProductRepository>;

    auditLogRepositoryMock = {
      create: vi.fn().mockResolvedValue({ id: 'log-1', action: 'CREATE', entity: 'INVOICE' }),
      findByCompanyId: vi.fn().mockResolvedValue([]),
      findByUserId: vi.fn().mockResolvedValue([])
    } as unknown as Mocked<IAuditLogRepository>;

    sut = new ReadInvoiceUseCase(
      storageProviderMock,
      aiProviderMock,
      productRepositoryMock,
      auditLogRepositoryMock
    );
  });

  it('deve cadastrar novos produtos no estoque quando não existirem nem por código nem por similaridade', async () => {
    const filePath = '/path/to/any/nota.png';
    const userId = 'user-any-id';
    const stockId = 'stock-1';

    const result = await sut.execute({ filePath, stockId, userId });

    expect(aiProviderMock.extractDanfeData).toHaveBeenCalledWith(filePath);
    expect(productRepositoryMock.save).toHaveBeenCalledTimes(2);

    expect(productRepositoryMock.save).toHaveBeenNthCalledWith(1, {
      ...mockAiResult.products[0],
      stockId,
      userId
    });

    expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'INVOICE',
        userId
      })
    );

    expect(result.extractedData.invoiceNumber).toBe('000542');
    expect(result.processedProducts).toHaveLength(2);
    expect(result.suggestions).toHaveLength(0);
    expect(storageProviderMock.deleteFile).toHaveBeenCalledWith(filePath);
  });

  it('deve realizar upsert (soma de quantidade) quando o produto já existir pelo código no estoque', async () => {
    const existingProduct: IProduct = {
      id: 'existing-id-1',
      code: '0982',
      description: 'PARAF SEXTAVADO 1/4 X 2',
      quantity: 10,
      unitMeasurement: 'UN',
      unitPrice: 2.00,
      totalPrice: 20.00,
      stockId: 'stock-1',
      userId: 'user-any-id'
    };

    // Mocka para encontrar o primeiro item pelo código
    productRepositoryMock.findByCode.mockImplementation((code, stockId) => {
      if (code === '0982') return Promise.resolve(existingProduct);
      return Promise.resolve(null);
    });

    const result = await sut.execute({ filePath: '/path/nota.png', stockId: 'stock-1', userId: 'user-any-id' });

    // O primeiro item deve fazer update e o segundo deve fazer save
    expect(productRepositoryMock.update).toHaveBeenCalledWith('existing-id-1', {
      quantity: 60, // 10 existentes + 50 da nota
      unitPrice: 2.50,
      totalPrice: 125.00,
      description: 'PARAF SEXTAVADO 1/4 X 2'
    });

    expect(productRepositoryMock.save).toHaveBeenCalledTimes(1);
    expect(result.processedProducts).toHaveLength(2);
    expect(auditLogRepositoryMock.create).toHaveBeenCalled();
  });

  it('deve gerar uma sugestão de vínculo quando a IA encontrar um produto similar no estoque', async () => {
    const similarProduct: IProduct = {
      id: 'similar-id',
      code: 'PAR-001',
      description: 'PARAFUSO SEXTAVADO 1/4 INCH',
      quantity: 100,
      unitMeasurement: 'UN',
      unitPrice: 2.10,
      totalPrice: 210.00,
      stockId: 'stock-1',
      userId: 'user-any-id'
    };

    productRepositoryMock.findByStockId.mockResolvedValue([similarProduct]);

    // Simula a IA dizendo que o 1º produto da nota é similar ao produto do estoque
    aiProviderMock.findSimilarProduct.mockImplementation((desc) => {
      if (desc.includes('PARAF')) {
        return Promise.resolve({
          product: similarProduct,
          confidence: 0.88,
          reason: 'Descrição equivalente para parafuso'
        });
      }
      return Promise.resolve(null);
    });

    const result = await sut.execute({ filePath: '/path/nota.png', stockId: 'stock-1', userId: 'user-any-id' });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.suggestedProduct.id).toBe('similar-id');
    expect(result.suggestions[0]?.confidence).toBe(0.88);
    // Apenas 1 produto criado direto (o segundo item), pois o primeiro virou sugestão
    expect(productRepositoryMock.save).toHaveBeenCalledTimes(1);
    expect(auditLogRepositoryMock.create).toHaveBeenCalled();
  });
});