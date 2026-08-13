import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import { AppError } from '../../errors/app-error.js';

describe('ReadInvoiceUseCase idempotency', () => {
  const accessKey = '1'.repeat(44);
  const invoice = {
    accessKey,
    invoiceNumber: '123',
    series: '1',
    issuedAt: new Date(),
    totalValue: 10,
    supplier: { cnpj: '123', name: 'Supplier', stateRegistration: '1' },
    products: [{ code: 'A', description: 'A', quantity: 2, unitMeasurement: 'UN', unitPrice: 5, totalPrice: 10 }],
  };
  const storage = { readFile: vi.fn(), deleteFile: vi.fn() };
  const ai = { extractDanfeData: vi.fn(), findSimilarProduct: vi.fn() };
  const products = {
    save: vi.fn(), findByCode: vi.fn(), findByUserId: vi.fn(), findByStockId: vi.fn(),
    findByCompanyId: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn(),
  };
  const audit = { create: vi.fn(), findByCompanyId: vi.fn(), findByUserId: vi.fn() };
  const stocks = { create: vi.fn(), findById: vi.fn(), findByIdForUser: vi.fn(), findByCompanyId: vi.fn() };
  const persistence = { persist: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    storage.deleteFile.mockResolvedValue(undefined);
    stocks.findByIdForUser.mockResolvedValue({ id: 'stock-1', companyId: 'company-1', name: 'Stock' });
    ai.extractDanfeData.mockResolvedValue(invoice);
    ai.findSimilarProduct.mockResolvedValue(null);
    products.findByStockId.mockResolvedValue([]);
    products.findByCode.mockResolvedValue(null);
    persistence.persist.mockImplementation(async ({ operations }: { operations: Array<{ product: object }> }) =>
      operations.map(({ product }) => product)
    );
  });

  const makeSut = () => new (ReadInvoiceUseCase as any)(storage, ai, products, audit, stocks, persistence);

  it('envia a chave e o estoque junto dos itens na primeira submissao', async () => {
    await makeSut().execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' });

    expect(persistence.persist).toHaveBeenCalledWith(expect.objectContaining({
      accessKey,
      stockId: 'stock-1',
      operations: expect.any(Array),
    }));
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ entity: 'INVOICE', entityId: accessKey, companyId: 'company-1' }));
  });

  it('segunda submissao e uma condicao de dominio 409 e nao aplica nova entrada', async () => {
    const processedKeys = new Set<string>();
    let appliedQuantity = 0;
    persistence.persist.mockImplementation(async ({ accessKey: key, operations }: {
      accessKey: string;
      operations: Array<{ product: { quantity: number } }>;
    }) => {
      if (processedKeys.has(key)) throw new AppError('NF-e ja processada.', 409);
      processedKeys.add(key);
      appliedQuantity += operations.reduce((sum, operation) => sum + operation.product.quantity, 0);
      return operations.map(({ product }) => product);
    });

    await makeSut().execute({ filePath: '/tmp/first', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' });
    await expect(makeSut().execute({ filePath: '/tmp/second', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' }))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(appliedQuantity).toBe(2);
    expect(storage.deleteFile).toHaveBeenCalledWith('/tmp/first');
    expect(storage.deleteFile).toHaveBeenCalledWith('/tmp/second');
    expect(products.save).not.toHaveBeenCalled();
    expect(products.update).not.toHaveBeenCalled();
  });

  it.each([
    ['curta', '1'.repeat(43)],
    ['longa', '1'.repeat(45)],
    ['com letras', `${'1'.repeat(43)}A`],
    ['com separadores', `${'1'.repeat(22)} ${'1'.repeat(21)}`],
  ])('rejeita chave %s antes da fase de persistencia', async (_case, invalidAccessKey) => {
    ai.extractDanfeData.mockResolvedValueOnce({ ...invoice, accessKey: invalidAccessKey });

    await expect(makeSut().execute({ filePath: '/tmp/invalid', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' }))
      .rejects.toMatchObject({ statusCode: 422 });

    expect(persistence.persist).not.toHaveBeenCalled();
    expect(products.findByStockId).not.toHaveBeenCalled();
  });
});
