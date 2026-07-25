import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import type { IStorageProvider } from '../../providers/storage.provider.js';
import type { IAiProvider, IDanfeExtractResult } from '../../providers/ai.provider.js';
import type { IProductRepository, IProduct } from '../../repositories/product.repository.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import type { IStockRepository } from '../../repositories/stock.repository.js';

describe('ReadInvoiceUseCase', () => {
  let storageProviderMock: Mocked<IStorageProvider>;
  let aiProviderMock: Mocked<IAiProvider>;
  let productRepositoryMock: Mocked<IProductRepository>;
  let auditLogRepositoryMock: Mocked<IAuditLogRepository>;
  let stockRepositoryMock: Mocked<IStockRepository>;
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

    stockRepositoryMock = {
      findById: vi.fn().mockResolvedValue({
        id: 'stock-1',
        name: 'Estoque Principal',
        companyId: 'company-1',
      }),
      findByCompanyId: vi.fn().mockResolvedValue([]),
      create: vi.fn()
    } as unknown as Mocked<IStockRepository>;

    auditLogRepositoryMock = {
      create: vi.fn().mockResolvedValue({ id: 'log-1', action: 'CREATE', entity: 'INVOICE' }),
      findByCompanyId: vi.fn().mockResolvedValue([]),
      findByUserId: vi.fn().mockResolvedValue([])
    } as unknown as Mocked<IAuditLogRepository>;

    sut = new ReadInvoiceUseCase(
      storageProviderMock,
      aiProviderMock,
      productRepositoryMock,
      auditLogRepositoryMock,
      stockRepositoryMock
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

    productRepositoryMock.findByCode.mockImplementation((code) => {
      if (code === '0982') return Promise.resolve(existingProduct);
      return Promise.resolve(null);
    });

    const result = await sut.execute({ filePath: '/path/nota.png', stockId: 'stock-1', userId: 'user-any-id' });

    expect(productRepositoryMock.update).toHaveBeenCalledWith('existing-id-1', {
      quantity: 60,
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
    expect(productRepositoryMock.save).toHaveBeenCalledTimes(1);
    expect(auditLogRepositoryMock.create).toHaveBeenCalled();
  });

  it('deve lançar AppError e deletar o arquivo temporário quando a IA retornar uma estrutura inválida ou sem produtos', async () => {
    const invalidAiResult = {
      ...mockAiResult,
      products: []
    };

    aiProviderMock.extractDanfeData.mockResolvedValueOnce(invalidAiResult as unknown as IDanfeExtractResult);

    await expect(
      sut.execute({ filePath: '/path/nota.png', stockId: 'stock-1', userId: 'user-any-id' })
    ).rejects.toThrow('Falha ao extrair produtos do DANFE. Nenhum item válido encontrado.');

    expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/nota.png');
    expect(productRepositoryMock.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar produtos com valores ou quantidades negativas/zeradas retornadas pela IA', async () => {
    const maliciousAiResult: IDanfeExtractResult = {
      ...mockAiResult,
      products: [
        {
          code: 'MAL-01',
          description: 'PRODUTO COM QUANTIDADE NEGATIVA',
          quantity: -10,
          unitMeasurement: 'UN',
          unitPrice: 5.00,
          totalPrice: -50.00
        }
      ]
    };

    aiProviderMock.extractDanfeData.mockResolvedValueOnce(maliciousAiResult);

    await expect(
      sut.execute({ filePath: '/path/nota.png', stockId: 'stock-1', userId: 'user-any-id' })
    ).rejects.toThrow('Os produtos do DANFE contêm valores ou quantidades inválidas.');

    expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/nota.png');
    expect(productRepositoryMock.save).not.toHaveBeenCalled();
  });

  it('deve sanitizar a descrição dos produtos removendo scripts ou códigos nocivos retornados pela IA', async () => {
    const promptInjectionAiResult: IDanfeExtractResult = {
      ...mockAiResult,
      products: [
        {
          code: 'SEC-01',
          description: '<script>alert("xss")</script> PARAFUSO AÇO INOX -- IGNORE REST',
          quantity: 10,
          unitMeasurement: 'UN',
          unitPrice: 3.00,
          totalPrice: 30.00
        }
      ]
    };

    aiProviderMock.extractDanfeData.mockResolvedValueOnce(promptInjectionAiResult);

    await sut.execute({ filePath: '/path/nota.png', stockId: 'stock-1', userId: 'user-any-id' });

    expect(productRepositoryMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'PARAFUSO AÇO INOX -- IGNORE REST'
      })
    );
  });

  it('deve lançar AppError, registrar log de auditoria de falha e deletar o arquivo temporário quando o estoque informado não existir ou não for encontrado', async () => {
  stockRepositoryMock.findById.mockResolvedValueOnce(null);

  await expect(
    sut.execute({
      filePath: '/path/nota.png',
      stockId: 'unauthorized-stock-id',
      userId: 'user-any-id',
    })
  ).rejects.toThrow('Acesso não autorizado ao estoque informado.');

  // 🎯 Teste exige a ação precisa de segurança
  expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'UNAUTHORIZED_ACCESS',
      entity: 'INVOICE',
      userId: 'user-any-id',
      details: expect.stringContaining('unauthorized-stock-id'),
    })
  );

  expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/nota.png');
  expect(aiProviderMock.extractDanfeData).not.toHaveBeenCalled();
  expect(productRepositoryMock.save).not.toHaveBeenCalled();
});
});