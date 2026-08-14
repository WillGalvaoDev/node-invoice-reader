import { describe, expect, it } from 'vitest';
import { isValidCnpj, normalizeCnpj, parseCnpj } from './cnpj.js';
describe('CNPJ', () => {
    it.each([
        ['11222333000181', '11222333000181'],
        ['11.222.333/0001-81', '11222333000181'],
        ['12ABC34501DE35', '12ABC34501DE35'],
        ['12.ABC.345/01DE-35', '12ABC34501DE35'],
        ['  12.abc.345/01de-35  ', '12ABC34501DE35'],
    ])('normaliza %s para a representação canônica', (input, expected) => {
        expect(normalizeCnpj(input)).toBe(expected);
    });
    it.each([
        '',
        '123',
        '12.ABC.345/01DE#35',
        '12ABC34501DE³5',
        '１２ABC34501DE35',
        '12.ABC345/01DE-35',
        '12.ABC.345/01DE/35',
    ])('rejeita formato não oficial sem remover símbolos arbitrários: %s', (input) => {
        expect(() => normalizeCnpj(input)).toThrow();
    });
    it.each([
        '11222333000181',
        '04.252.011/0001-10',
        '12.ABC.345/01DE-35',
    ])('aceita vetor válido independente %s', (input) => {
        expect(isValidCnpj(input)).toBe(true);
    });
    it.each([
        '11222333000101',
        '11222333000180',
        '11111111111111',
        '12ABC34501DE34',
        '12BBC34501DE35',
        '12ABC34502DE35',
    ])('rejeita DV/corpo inválido %s', (input) => {
        expect(isValidCnpj(input)).toBe(false);
    });
    it('retorna somente CNPJ válido e canônico', () => {
        expect(parseCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
        expect(() => parseCnpj('12.ABC.345/01DE-34')).toThrow();
    });
});
//# sourceMappingURL=cnpj.spec.js.map