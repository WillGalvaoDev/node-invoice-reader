import { describe, expect, it } from 'vitest';
import type { IDanfeExtractResult } from '../providers/ai.provider.js';
import { assertDanfeCoherence, DANFE_TOTAL_TOLERANCE } from './danfe-coherence.js';

function invoice(products: IDanfeExtractResult['products'], totalValue: number): IDanfeExtractResult {
  return { accessKey: '1'.repeat(44), invoiceNumber: '1', series: '1', issuedAt: new Date('2026-01-01'), supplier: { cnpj: '11222333000181', name: 'Fornecedor' }, products, totalValue };
}

const item = (quantity: number, unitPrice: number, totalPrice: number, code = 'A') => ({ code, description: code, quantity, unitPrice, totalPrice, unitMeasurement: 'UN' });

describe('assertDanfeCoherence', () => {
  it.each([
    ['um item exato', invoice([item(2, 10, 20)], 20)],
    ['múltiplos itens exatos', invoice([item(2, 10, 20), item(3, 5.5, 16.5, 'B')], 36.5)],
    ['quantidade fracionária', invoice([item(1.5, 10, 15)], 15)],
    ['ruído binário legítimo', invoice([item(3, 0.1, 0.3)], 0.3)],
    ['divergência no limite absoluto', invoice([item(1, 10, 10.02)], 10.02)],
    ['divergência no limite percentual', invoice([item(1, 10, 10.1)], 10.1)],
    ['soma no limite global', invoice([item(1, 10, 10)], 9.98)],
    ['total maior por componentes fiscais', invoice([item(2, 10, 20)], 25)],
  ])('aceita %s', (_case, data) => expect(() => assertDanfeCoherence(data)).not.toThrow());

  it.each([
    ['quantity alterada', invoice([item(20, 10, 20)], 20)],
    ['unitPrice alterado', invoice([item(2, 100, 20)], 20)],
    ['total do item alterado', invoice([item(2, 10, 30)], 30)],
    ['imediatamente acima da tolerância percentual', invoice([item(1, 10, 10.101)], 10.101)],
    ['soma dos itens acima da nota', invoice([item(2, 10, 20), item(1, 5, 5, 'B')], 24.97)],
    ['soma imediatamente acima do limite global', invoice([item(1, 10, 10)], 9.979)],
    ['total declarado com dígito alterado para baixo', invoice([item(2, 10, 20)], 2)],
  ])('rejeita %s com erro controlado 422', (_case, data) => {
    expect(() => assertDanfeCoherence(data)).toThrow(expect.objectContaining({ statusCode: 422 }));
  });

  it('é determinística, independente da ordem e não muta o input', () => {
    const original = invoice([item(2, 10, 20), item(3, 5.5, 16.5, 'B')], 36.5);
    const snapshot = structuredClone(original);
    const reversed = { ...original, products: [...original.products].reverse() };
    expect(() => assertDanfeCoherence(original)).not.toThrow();
    expect(() => assertDanfeCoherence(reversed)).not.toThrow();
    expect(original).toEqual(snapshot);
    expect(DANFE_TOTAL_TOLERANCE.toString()).toBe('0.02');
  });
});
