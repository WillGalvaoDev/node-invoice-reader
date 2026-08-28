import { describe, expect, it } from 'vitest';
import { createDanfeResponseSchema } from './gemini.schemas.js';

function danfeWithProducts(count: number) {
  return {
    accessKey: '1'.repeat(44),
    invoiceNumber: '1',
    series: '1',
    issuedAt: '2026-01-01',
    totalValue: 10,
    supplier: { cnpj: '11222333000181', name: 'Supplier' },
    products: Array.from({ length: count }, (_, index) => ({
      code: `P${index}`, description: `Produto ${index}`,
      quantity: 1, unitPrice: 10, totalPrice: 10, unitMeasurement: 'UN',
    })),
  };
}

describe('createDanfeResponseSchema — teto de itens por DANFE (P4-01, D1)', () => {
  it('aceita exatamente N itens', () => {
    const schema = createDanfeResponseSchema(3);
    const result = schema.safeParse(danfeWithProducts(3));
    expect(result.success).toBe(true);
  });

  it('recusa N+1 itens', () => {
    const schema = createDanfeResponseSchema(3);
    const result = schema.safeParse(danfeWithProducts(4));
    expect(result.success).toBe(false);
  });

  it('continua exigindo ao menos 1 item', () => {
    const schema = createDanfeResponseSchema(100);
    const result = schema.safeParse(danfeWithProducts(0));
    expect(result.success).toBe(false);
  });

  it('preserva as demais validações do DANFE (accessKey de 44 dígitos)', () => {
    const schema = createDanfeResponseSchema(100);
    const invalid = { ...danfeWithProducts(1), accessKey: '123' };
    const result = schema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
