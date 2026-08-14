import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  processedInvoice: { create: vi.fn() },
  $queryRaw: vi.fn(),
  auditLog: { create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('../infra/prisma.js', () => ({ prisma: prismaMock }));

describe('PrismaInvoicePersistenceRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    tx.$queryRaw.mockImplementation(async (query) => [{
      id: query.values[1], code: query.values[1], description: query.values[2], quantity: query.values[3],
      unitMeasurement: query.values[4], unitPrice: query.values[5], totalPrice: query.values[6],
      stockId: query.values[7], userId: query.values[8], createdAt: new Date(), ean: null, ncm: null,
    }]);
    tx.processedInvoice.create.mockResolvedValue({ id: 'invoice-1' });
    tx.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  const product = (code: string, quantity = 1) => ({
    product: { code, description: code, quantity, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 2, stockId: 'stock-1', userId: 'user-1' },
  });

  it('usa um transaction client para identidade e todos os itens com upsert ponderado atômico', async () => {
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    await new PrismaInvoicePersistenceRepository().persist({
      accessKey: '1'.repeat(44), stockId: 'stock-1',
      operations: [product('A', 2), product('B', 3)],
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.processedInvoice.create).toHaveBeenCalledWith({ data: { accessKey: '1'.repeat(44), stockId: 'stock-1' } });
    expect(tx.processedInvoice.create.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[0]!);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const sql = tx.$queryRaw.mock.calls[0]?.[0].strings.join(' ');
    expect(sql).toContain('ON CONFLICT ("stockId", "code") DO UPDATE');
    expect(sql).toContain('"products"."quantity" * "products"."unitPrice"');
    expect(sql).toContain('EXCLUDED."quantity" * EXCLUDED."unitPrice"');
    expect(sql).toContain('ROUND');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('mantém somente identidade e itens na transação principal', async () => {
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    await new PrismaInvoicePersistenceRepository().persist({
      accessKey: '9'.repeat(44), stockId: 'stock-1', operations: [product('A')],
    });

    expect(tx.processedInvoice.create).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('propaga falha do item N pelo callback para rollback e não grava auditoria', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'A' }]).mockRejectedValueOnce(new Error('item N failed'));
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');

    await expect(new PrismaInvoicePersistenceRepository().persist({
      accessKey: '1'.repeat(44), stockId: 'stock-1',
      operations: [product('A'), product('B')],
    })).rejects.toThrow('item N failed');

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('não perde incrementos em duas entradas concorrentes', async () => {
    let quantity = 10;
    tx.$queryRaw.mockImplementation(async (query) => {
      quantity += Number(query.values[3]);
      return [{
        id: 'A', code: query.values[1], description: query.values[2], quantity,
        unitMeasurement: query.values[4], unitPrice: query.values[5], totalPrice: query.values[6],
        stockId: query.values[7], userId: query.values[8], createdAt: new Date(), ean: null, ncm: null,
      }];
    });
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    const repository = new PrismaInvoicePersistenceRepository();

    await Promise.all([
      repository.persist({ accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A', 5)] }),
      repository.persist({ accessKey: '2'.repeat(44), stockId: 'stock-1', operations: [product('A', 7)] }),
    ]);

    expect(quantity).toBe(22);
  });

  it('nao tenta alterar produtos quando o registro da identidade falha', async () => {
    tx.processedInvoice.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['access_key'] } });
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');

    await expect(new PrismaInvoicePersistenceRepository().persist({
      accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A')],
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.$queryRaw).not.toHaveBeenCalled();
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
    tx.$queryRaw.mockRejectedValueOnce(new Error('item failed'));
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    const repository = new PrismaInvoicePersistenceRepository();
    const plan = {
      accessKey: '1'.repeat(44), stockId: 'stock-1', operations: [product('A')],
    };

    await expect(repository.persist(plan)).rejects.toThrow('item failed');
    expect(persistedKeys).not.toContain(plan.accessKey);

    tx.$queryRaw.mockImplementationOnce(async (query) => [{
      id: query.values[1], code: query.values[1], description: query.values[2], quantity: query.values[3],
      unitMeasurement: query.values[4], unitPrice: query.values[5], totalPrice: query.values[6],
      stockId: query.values[7], userId: query.values[8], createdAt: new Date(), ean: null, ncm: null,
    }]);
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
    };

    const results = await Promise.allSettled([repository.persist(plan), repository.persist(plan)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')[0]).toMatchObject({
      reason: expect.objectContaining({ statusCode: 409 }),
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });

  it('usa description recebida no INSERT sem sobrescrever description no conflito', async () => {
    const { PrismaInvoicePersistenceRepository } = await import('./prisma-invoice-persistence.repository.js');
    await new PrismaInvoicePersistenceRepository().persist({
      accessKey: '8'.repeat(44), stockId: 'stock-1',
      operations: [{ product: { ...product('A').product, description: 'Descrição extraída diferente' } }],
    });

    const query = tx.$queryRaw.mock.calls[0]?.[0];
    const sql = query.strings.join(' ');
    expect(query.values).toContain('Descrição extraída diferente');
    expect(sql).toContain('INSERT INTO "products"');
    expect(sql).not.toContain('"description" = EXCLUDED."description"');
  });
});
