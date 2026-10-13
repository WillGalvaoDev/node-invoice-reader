import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { AppError } from '../../src/errors/app-error.js';
import { PrismaInvoicePersistenceRepository } from '../../src/repositories/prisma-invoice-persistence.repository.js';
import { PrismaProductSuggestionRepository } from '../../src/repositories/prisma-product-suggestion.repository.js';
import { PrismaProductRepository } from '../../src/repositories/prisma-product.repository.js';

const SUPPLIER_A = '11222333000181';
const SUPPLIER_B = '45723174000110';

beforeEach(async () => {
  await prisma.aiCallEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.productSimilaritySuggestion.deleteMany();
  await prisma.processedInvoice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.stockPermission.deleteMany();
  await prisma.companyCollaborator.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(disconnectPrisma);

async function fixture() {
  const owner = await prisma.user.create({ data: { email: 'origin@example.test', name: 'Origin', password: 'synthetic' } });
  const company = await prisma.company.create({ data: { name: 'Origin', cnpj: '11222333000181', ownerId: owner.id } });
  const stock = await prisma.stock.create({ data: { name: 'Origin', companyId: company.id } });
  return { owner, stock };
}

const entry = (stockId: string, overrides: Record<string, unknown> = {}) => ({
  code: 'CAN-A', description: 'Caneta', quantity: 10, unitMeasurement: 'UN',
  unitPrice: 2, totalPrice: 20, stockId, sourceSupplierCnpj: SUPPLIER_A, ...overrides,
});
const key = (n: number) => String(n).padStart(44, '0');
const persistence = new PrismaInvoicePersistenceRepository();

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 201;
  } catch (error) {
    return error instanceof AppError ? error.statusCode : 500;
  }
}

describe('origem e unidade de produto (DP-01 / I01)', () => {
  it('I-T01: mesma origem e unidade normalizada acumula e preserva a origem', async () => {
    const { stock } = await fixture();
    await persistence.persist({ accessKey: key(1), stockId: stock.id, operations: [{ product: entry(stock.id) }] });
    const [updated] = await persistence.persist({
      accessKey: key(2), stockId: stock.id,
      operations: [{ product: entry(stock.id, { quantity: 2, totalPrice: 4, unitMeasurement: ' un ' }) }],
    });

    expect(updated).toMatchObject({ quantity: 12, sourceSupplierCnpj: SUPPLIER_A });
  });

  it('normaliza espaços internos e caixa da unidade no banco como no domínio', async () => {
    const { stock } = await fixture();
    await persistence.persist({
      accessKey: key(1), stockId: stock.id,
      operations: [{ product: entry(stock.id, { unitMeasurement: 'Caixa  Grande' }) }],
    });

    const [updated] = await persistence.persist({
      accessKey: key(2), stockId: stock.id,
      operations: [{ product: entry(stock.id, { quantity: 1, totalPrice: 2, unitMeasurement: ' caixa grande ' }) }],
    });
    expect(updated).toMatchObject({ quantity: 11 });

    // Letras iguais não bastam: "caixas grande" (com s) é outra unidade.
    const status = await statusOf(persistence.persist({
      accessKey: key(3), stockId: stock.id,
      operations: [{ product: entry(stock.id, { unitMeasurement: 'caixas grande' }) }],
    }));
    expect(status).toBe(422);
  });

  it.each([
    ['fornecedor diferente', { sourceSupplierCnpj: SUPPLIER_B }],
    ['unidade UN × CX', { unitMeasurement: 'CX' }],
  ])('I-T02/I-T03 revalida na transação: %s recusa 422 e preserva catálogo e chave', async (_name, conflict) => {
    const { stock } = await fixture();
    await persistence.persist({ accessKey: key(1), stockId: stock.id, operations: [{ product: entry(stock.id) }] });

    const status = await statusOf(persistence.persist({
      accessKey: key(2), stockId: stock.id, operations: [{ product: entry(stock.id, conflict) }],
    }));

    expect(status).toBe(422);
    expect(await prisma.processedInvoice.count()).toBe(1);
    expect(Number((await prisma.product.findFirstOrThrow()).quantity)).toBe(10);
  });

  it('I-T04/I-T11: produto legado sem origem é legível, mas o match exato é recusado sem inferência', async () => {
    const { stock } = await fixture();
    await prisma.product.create({
      data: { code: 'CAN-A', description: 'Legado', quantity: 5, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 10, stockId: stock.id },
    });

    const products = await new PrismaProductRepository().findByStockId(stock.id);
    expect(products[0]).toMatchObject({ code: 'CAN-A', sourceSupplierCnpj: null });

    const status = await statusOf(persistence.persist({
      accessKey: key(3), stockId: stock.id, operations: [{ product: entry(stock.id) }],
    }));
    expect(status).toBe(422);
    expect(Number((await prisma.product.findFirstOrThrow()).quantity)).toBe(5);
    expect(await prisma.processedInvoice.count()).toBe(0);
  });

  it('I-T05: duas primeiras entradas concorrentes com fornecedores diferentes não se misturam', async () => {
    const { stock } = await fixture();
    const results = await Promise.all([
      statusOf(persistence.persist({ accessKey: key(10), stockId: stock.id, operations: [{ product: entry(stock.id, { sourceSupplierCnpj: SUPPLIER_A }) }] })),
      statusOf(persistence.persist({ accessKey: key(11), stockId: stock.id, operations: [{ product: entry(stock.id, { sourceSupplierCnpj: SUPPLIER_B }) }] })),
    ]);

    expect([...results].sort()).toEqual([201, 422]);
    const products = await prisma.product.findMany();
    expect(products).toHaveLength(1);
    expect(Number(products[0]!.quantity)).toBe(10);
    expect(await prisma.processedInvoice.count()).toBe(1);
  });
});

describe('decisões sobre sugestões (DP-01 / I01)', () => {
  async function pendingSuggestion(overrides: { unitMeasurement?: string } = {}) {
    const { owner, stock } = await fixture();
    await persistence.persist({ accessKey: key(1), stockId: stock.id, operations: [{ product: entry(stock.id) }] });
    const target = await prisma.product.findFirstOrThrow();
    const invoice = await prisma.processedInvoice.create({ data: { accessKey: key(2), stockId: stock.id } });
    const suggestion = await prisma.productSimilaritySuggestion.create({
      data: {
        processedInvoiceId: invoice.id, itemIndex: 0, stockId: stock.id, suggestedProductId: target.id,
        receivedCode: 'CAN-B', receivedDescription: 'Caneta B', receivedQuantity: 3,
        receivedUnitPrice: 5, unitMeasurement: overrides.unitMeasurement ?? 'UN', confidence: 0.9, reason: 'similar',
        receivedSupplierCnpj: SUPPLIER_B,
      },
    });
    return { owner, stock, target, suggestion };
  }
  const repository = new PrismaProductSuggestionRepository();

  it('confirma entre códigos diferentes preservando a origem do produto', async () => {
    const { owner, suggestion } = await pendingSuggestion();
    await repository.confirm(suggestion.id, owner.id);
    const product = await prisma.product.findFirstOrThrow({ where: { code: 'CAN-A' } });
    expect(Number(product.quantity)).toBe(13);
    expect(product.sourceSupplierCnpj).toBe(SUPPLIER_A);
  });

  it('I-T07: confirmar com unidade incompatível responde 422 e mantém a sugestão pendente', async () => {
    const { owner, suggestion } = await pendingSuggestion({ unitMeasurement: 'CX' });
    const status = await statusOf(repository.confirm(suggestion.id, owner.id));

    expect(status).toBe(422);
    expect((await prisma.productSimilaritySuggestion.findUniqueOrThrow({ where: { id: suggestion.id } })).status).toBe('PENDING');
    expect(Number((await prisma.product.findFirstOrThrow()).quantity)).toBe(10);
  });

  it('I-T07: rejeitar com código ocupado responde 409 e mantém a sugestão pendente', async () => {
    const { owner, stock, suggestion } = await pendingSuggestion();
    await prisma.product.create({
      data: { code: 'CAN-B', description: 'Ocupado', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: stock.id, sourceSupplierCnpj: SUPPLIER_B },
    });

    const status = await statusOf(repository.reject(suggestion.id, owner.id));

    expect(status).toBe(409);
    expect((await prisma.productSimilaritySuggestion.findUniqueOrThrow({ where: { id: suggestion.id } })).status).toBe('PENDING');
    expect(Number((await prisma.product.findFirstOrThrow({ where: { code: 'CAN-B' } })).quantity)).toBe(1);
  });

  it('rejeição cria o produto novo com a origem recebida na sugestão', async () => {
    const { owner, suggestion } = await pendingSuggestion();
    await repository.reject(suggestion.id, owner.id);
    const created = await prisma.product.findFirstOrThrow({ where: { code: 'CAN-B' } });
    expect(created.sourceSupplierCnpj).toBe(SUPPLIER_B);
    expect(Number(created.quantity)).toBe(3);
  });

  it('I-T06: confirmar e rejeitar simultâneos aplicam uma única decisão', async () => {
    const { owner, suggestion } = await pendingSuggestion();
    const [confirmStatus, rejectStatus] = await Promise.all([
      statusOf(repository.confirm(suggestion.id, owner.id)),
      statusOf(repository.reject(suggestion.id, owner.id)),
    ]);

    expect([confirmStatus, rejectStatus].sort()).toEqual([201, 409]);
    const products = await prisma.product.findMany();
    const quantities = Object.fromEntries(products.map((product) => [product.code, Number(product.quantity)]));
    const confirmed = quantities['CAN-A'] === 13 && quantities['CAN-B'] === undefined;
    const rejected = quantities['CAN-A'] === 10 && quantities['CAN-B'] === 3;
    expect(confirmed || rejected).toBe(true);
  });
});
