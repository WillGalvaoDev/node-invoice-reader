import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  processedInvoice: { create: vi.fn() },
  product: { upsert: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('../infra/prisma.js', () => ({ prisma: prismaMock }));

describe('PrismaInvoicePersistenceRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    tx.product.upsert.mockImplementation(async ({ create }) => ({ id: create.code, createdAt: new Date(), ean: null, ncm: null, ...create }));
    tx.processedInvoice.create.mockResolvedValue({ id: 'invoice-1' });
    tx.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  const product = (code: string, quantity = 1) => ({
    product: { code, description: code, quantity, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 2, stockId: 'stock-1', userId: 'user-1' },
  });

  it('usa um transaction client para todos os itens e auditoria com incremento atômico', async () => {
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    await new PrismaInvoicePersistenceRepository().persist({
      accessKey: '1'.repeat(44), stockId: 'stock-1',
      operations: [product('A', 2), product('B', 3)], auditLog: { action: 'CREATE', entity: 'INVOICE' },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.processedInvoice.create).toHaveBeenCalledWith({ data: { accessKey: '1'.repeat(44), stockId: 'stock-1' } });
    expect(tx.processedInvoice.create.mock.invocationCallOrder[0]).toBeLessThan(tx.product.upsert.mock.invocationCallOrder[0]!);
    expect(tx.product.upsert).toHaveBeenCalledTimes(2);
    expect(tx.product.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { stockId_code: { stockId: 'stock-1', code: 'A' } },
      update: expect.objectContaining({ quantity: { increment: 2 } }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it('propaga falha do item N pelo callback para rollback e não grava auditoria', async () => {
    tx.product.upsert.mockResolvedValueOnce({ id: 'A' }).mockRejectedValueOnce(new Error('item N failed'));
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');

    await expect(new PrismaInvoicePersistenceRepository().persist({
      accessKey: '1'.repeat(44), stockId: 'stock-1',
      operations: [product('A'), product('B')], auditLog: { action: 'CREATE', entity: 'INVOICE' },
    })).rejects.toThrow('item N failed');

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('não perde incrementos em duas entradas concorrentes', async () => {
    let quantity = 10;
    tx.product.upsert.mockImplementation(async ({ update, create }) => {
      quantity += update.quantity.increment;
      return { id: 'A', createdAt: new Date(), ean: null, ncm: null, ...create, quantity };
    });
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    const repository = new PrismaInvoicePersistenceRepository();

    await Promise.all([
      repository.persist({ accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A', 5)], auditLog: { action: 'CREATE', entity: 'INVOICE' } }),
      repository.persist({ accessKey: '2'.repeat(44), stockId: 'stock-1', operations: [product('A', 7)], auditLog: { action: 'CREATE', entity: 'INVOICE' } }),
    ]);

    expect(quantity).toBe(22);
  });

  it('nao tenta alterar produtos quando o registro da identidade falha', async () => {
    tx.processedInvoice.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['access_key'] } });
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');

    await expect(new PrismaInvoicePersistenceRepository().persist({
      accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A')],
      auditLog: { action: 'CREATE', entity: 'INVOICE' },
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.product.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('libera a chave pelo rollback quando um item falha e permite nova tentativa', async () => {
    const persistedKeys = new Set<string>();
    tx.processedInvoice.create.mockImplementation(async ({ data }) => {
      if (persistedKeys.has(data.accessKey)) throw { code: 'P2002' };
      persistedKeys.add(data.accessKey);
      return { id: 'invoice-1' };
    });
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      const snapshot = new Set(persistedKeys);
      try {
        return await callback(tx);
      } catch (error) {
        persistedKeys.clear();
        snapshot.forEach((key) => persistedKeys.add(key));
        throw error;
      }
    });
    tx.product.upsert.mockRejectedValueOnce(new Error('item failed'));
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    const repository = new PrismaInvoicePersistenceRepository();
    const plan = {
      accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A')],
      auditLog: { action: 'CREATE' as const, entity: 'INVOICE' },
    };

    await expect(repository.persist(plan)).rejects.toThrow('item failed');
    expect(persistedKeys).not.toContain(plan.accessKey);

    tx.product.upsert.mockImplementationOnce(async ({ create }) => ({ id: create.code, createdAt: new Date(), ean: null, ncm: null, ...create }));
    await expect(repository.persist(plan)).resolves.toHaveLength(1);
  });

  it('sob concorrencia estrutural da mesma chave apenas uma tentativa chega ao upsert', async () => {
    const persistedKeys = new Set<string>();
    tx.processedInvoice.create.mockImplementation(async ({ data }) => {
      if (persistedKeys.has(data.accessKey)) throw { code: 'P2002' };
      persistedKeys.add(data.accessKey);
      return { id: 'invoice-1' };
    });
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    const repository = new PrismaInvoicePersistenceRepository();
    const plan = {
      accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A', 5)],
      auditLog: { action: 'CREATE' as const, entity: 'INVOICE' },
    };

    const results = await Promise.allSettled([repository.persist(plan), repository.persist(plan)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')[0]).toMatchObject({
      reason: expect.objectContaining({ statusCode: 409 }),
    });
    expect(tx.product.upsert).toHaveBeenCalledOnce();
  });
});
