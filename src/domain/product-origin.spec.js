import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { assertCompatibleProductEntry, isSameUnitMeasurement, normalizeUnitMeasurement, } from './product-origin.js';
describe('normalizeUnitMeasurement', () => {
    it('ignora caixa e espaços redundantes, sem converter unidades diferentes', () => {
        expect(normalizeUnitMeasurement('  Un ')).toBe('un');
        expect(normalizeUnitMeasurement('C  X')).toBe('c x');
        expect(isSameUnitMeasurement('UN', ' un ')).toBe(true);
        expect(isSameUnitMeasurement('UN', 'CX')).toBe(false);
    });
});
describe('assertCompatibleProductEntry', () => {
    const incoming = { supplierCnpj: '11222333000181', unitMeasurement: 'UN' };
    it('aceita mesma origem e mesma unidade normalizada', () => {
        expect(() => assertCompatibleProductEntry({ sourceSupplierCnpj: '11222333000181', unitMeasurement: ' un' }, incoming)).not.toThrow();
    });
    it.each([
        ['fornecedor diferente', { sourceSupplierCnpj: '45723174000110', unitMeasurement: 'UN' }],
        ['origem legada desconhecida (null)', { sourceSupplierCnpj: null, unitMeasurement: 'UN' }],
        ['origem legada desconhecida (ausente)', { unitMeasurement: 'UN' }],
        ['unidade divergente', { sourceSupplierCnpj: '11222333000181', unitMeasurement: 'CX' }],
    ])('recusa com 422: %s', (_name, existing) => {
        try {
            assertCompatibleProductEntry(existing, incoming);
            expect.unreachable('deveria ter recusado');
        }
        catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect(error.statusCode).toBe(422);
        }
    });
});
//# sourceMappingURL=product-origin.spec.js.map