import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { PrismaInvoicePersistenceRepository } from '../../src/repositories/prisma-invoice-persistence.repository.js';
import { PrismaProductRepository } from '../../src/repositories/prisma-product.repository.js';
import { PrismaStockRepository } from '../../src/repositories/prisma-stock.repository.js';
import { PrismaAuditLogRepository } from '../../src/repositories/prisma-audit-log.repository.js';
import { ReadInvoiceUseCase } from '../../src/use-cases/read-invoice/read-invoice.use-case.js';
import { AppError } from '../../src/errors/app-error.js';
import type { IAiProvider, IDanfeExtractResult } from '../../src/providers/ai.provider.js';
import type { IStorageProvider } from '../../src/providers/storage.provider.js';
import type { IInvoicePersistencePlan } from '../../src/repositories/invoice-persistence.repository.js';
import type { IProduct } from '../../src/repositories/product.repository.js';

const persistence = new PrismaInvoicePersistenceRepository();

async function cleanDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.processedInvoice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.stockPermission.deleteMany();
  await prisma.companyCollaborator.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}

async function seedOwnerAndStock() {
  const owner = await prisma.user.create({
    data: { email: `owner-${crypto.randomUUID()}@test.local`, name: 'Owner', password: 'test-hash' },
  });
  const company = await prisma.company.create({
    data: { name: 'Empresa teste', cnpj: crypto.randomUUID(), ownerId: owner.id },
  });
  const stock = await prisma.stock.create({
    data: { name: 'Estoque teste', companyId: company.id },
  });
  return { owner, company, stock };
}

function product(stockId: string, code: string, quantity: number, overrides: Partial<IProduct> = {}): IProduct {
  return {
    code,
    description: `Produto ${code}`,
    quantity,
    unitMeasurement: 'UN',
    unitPrice: 10,
    totalPrice: 10 * quantity,
    stockId,
    ...overrides,
  };
}

function plan(stockId: string, accessKey: string, products: IProduct[]): IInvoicePersistencePlan {
  return {
    accessKey,
    stockId,
    operations: products.map((item) => ({ product: item })),
  };
}

beforeEach(cleanDatabase);
afterAll(disconnectPrisma);

describe('PostgreSQL Integration Gate', () => {
  it('aplica o schema completo e executa uma operação mínima com as constraints finais', async () => {
    const { stock } = await seedOwnerAndStock();
    const accessKey = '10000000000000000000000000000000000000000001';

    await persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'ZERO-1', 2)]));

    await expect(prisma.processedInvoice.findUnique({ where: { accessKey } })).resolves.toMatchObject({ stockId: stock.id });
    await expect(prisma.product.findUnique({ where: { stockId_code: { stockId: stock.id, code: 'ZERO-1' } } })).resolves.toMatchObject({ code: 'ZERO-1' });
  });

  it('faz rollback real de identidade, primeiro item e auditoria quando item posterior falha', async () => {
    const { stock } = await seedOwnerAndStock();
    const accessKey = '20000000000000000000000000000000000000000002';

    await expect(persistence.persist(plan(stock.id, accessKey, [
      product(stock.id, 'ROLLBACK-OK', 3),
      product(stock.id, 'ROLLBACK-FAIL', 1, { unitPrice: 10_000_000_000 }),
    ]))).rejects.toBeDefined();

    expect(await prisma.product.count({ where: { stockId: stock.id } })).toBe(0);
    expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);

    await persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'ROLLBACK-RETRY', 4)]));
    expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'ROLLBACK-RETRY' } } })).quantity)).toBe(4);
  });

  it('preserva ambos os incrementos em transações realmente concorrentes', async () => {
    const { stock } = await seedOwnerAndStock();
    await prisma.product.create({ data: product(stock.id, 'CONCURRENT', 10) });

    await Promise.all([
      persistence.persist(plan(stock.id, '30000000000000000000000000000000000000000003', [product(stock.id, 'CONCURRENT', 7)])),
      persistence.persist(plan(stock.id, '40000000000000000000000000000000000000000004', [product(stock.id, 'CONCURRENT', 11)])),
    ]);

    const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'CONCURRENT' } } });
    expect(Number(persisted.quantity)).toBe(28);
    expect(await prisma.processedInvoice.count()).toBe(2);
  });

  it('mantém idempotência concorrente, mapeia duplicata para 409 e persiste uma única entrada', async () => {
    const { stock } = await seedOwnerAndStock();
    const accessKey = '50000000000000000000000000000000000000000005';

    const results = await Promise.allSettled([
      persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'IDEMPOTENT', 6)])),
      persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'IDEMPOTENT', 6)])),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
    expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
    expect(await prisma.product.count({ where: { stockId: stock.id, code: 'IDEMPOTENT' } })).toBe(1);
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'IDEMPOTENT' } } })).quantity)).toBe(6);
    expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);
  });

  it('expõe a UNIQUE real como P2002 e mantém a tradução de domínio no fluxo normal', async () => {
    const { stock } = await seedOwnerAndStock();
    const accessKey = '60000000000000000000000000000000000000000006';
    await prisma.processedInvoice.create({ data: { accessKey, stockId: stock.id } });

    const directConflict = await prisma.processedInvoice.create({ data: { accessKey, stockId: stock.id } }).catch((error) => error);
    expect(directConflict).toMatchObject({ code: 'P2002' });

    const domainConflict = await persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'UNIQUE', 1)])).catch((error) => error);
    expect(domainConflict).toBeInstanceOf(AppError);
    expect(domainConflict).toMatchObject({ statusCode: 409 });
    expect(await prisma.product.count({ where: { code: 'UNIQUE' } })).toBe(0);
  });

  it('não persiste identidade nem saldo quando autorização é negada', async () => {
    const { stock } = await seedOwnerAndStock();
    const outsider = await prisma.user.create({
      data: { email: `outsider-${crypto.randomUUID()}@test.local`, name: 'Outsider', password: 'test-hash' },
    });
    const accessKey = '70000000000000000000000000000000000000000007';
    let aiCalls = 0;
    const extracted: IDanfeExtractResult = {
      accessKey, invoiceNumber: '7', series: '1', issuedAt: new Date(), totalValue: 5,
      supplier: { cnpj: '1', name: 'Fornecedor', stateRegistration: '1' },
      products: [{ code: 'DENIED', description: 'Negado', quantity: 1, unitPrice: 5, totalPrice: 5, unitMeasurement: 'UN' }],
    };
    const ai: IAiProvider = {
      async extractDanfeData() { aiCalls += 1; return extracted; },
      async findSimilarProduct() { return null; },
    };
    const storage: IStorageProvider = { async readFile() { return ''; }, async deleteFile() {} };
    const useCase = new ReadInvoiceUseCase(storage, ai, new PrismaProductRepository(), new PrismaAuditLogRepository(), new PrismaStockRepository(), persistence);

    await expect(useCase.execute({ filePath: 'controlled-test-file', mimeType: 'image/png', stockId: stock.id, userId: outsider.id })).rejects.toMatchObject({ statusCode: 403 });

    expect(aiCalls).toBe(0);
    expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
    expect(await prisma.product.count({ where: { stockId: stock.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'UNAUTHORIZED_ACCESS', userId: outsider.id } })).toBe(1);
  });

  it('mantém commit e idempotência reais quando o audit pós-operação falha', async () => {
    const { owner, company, stock } = await seedOwnerAndStock();
    const accessKey = '80000000000000000000000000000000000000000008';
    const extracted: IDanfeExtractResult = {
      accessKey, invoiceNumber: '8', series: '1', issuedAt: new Date(), totalValue: 5,
      supplier: { cnpj: '1', name: 'Fornecedor' },
      products: [{ code: 'AUDIT-FAIL', description: 'Produto', quantity: 5, unitPrice: 1, totalPrice: 5, unitMeasurement: 'UN' }],
    };
    const ai: IAiProvider = {
      async extractDanfeData() { return extracted; },
      async findSimilarProduct() { return null; },
    };
    const storage: IStorageProvider = { async readFile() { return ''; }, async deleteFile() {} };
    const failingAudit = {
      create: vi.fn().mockRejectedValue(new Error('controlled audit failure')),
      findByCompanyId: vi.fn(),
      findByUserId: vi.fn(),
    };
    const testLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const useCase = new ReadInvoiceUseCase(
      storage, ai, new PrismaProductRepository(), failingAudit,
      new PrismaStockRepository(), persistence, testLogger,
    );

    await expect(useCase.execute({
      filePath: 'controlled-success-file', mimeType: 'image/png', stockId: stock.id,
      userId: owner.id, requestId: 'postgres-audit-failure',
    })).resolves.toBeDefined();

    expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
    expect(Number((await prisma.product.findUniqueOrThrow({
      where: { stockId_code: { stockId: stock.id, code: 'AUDIT-FAIL' } },
    })).quantity)).toBe(5);
    expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);
    expect(failingAudit.create).toHaveBeenCalledWith(expect.objectContaining({ companyId: company.id }));
    expect(testLogger.error).toHaveBeenCalledOnce();

    await expect(useCase.execute({
      filePath: 'controlled-retry-file', mimeType: 'image/png', stockId: stock.id, userId: owner.id,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
    expect(Number((await prisma.product.findUniqueOrThrow({
      where: { stockId_code: { stockId: stock.id, code: 'AUDIT-FAIL' } },
    })).quantity)).toBe(5);
    expect(failingAudit.create).toHaveBeenCalledOnce();
  });
});
