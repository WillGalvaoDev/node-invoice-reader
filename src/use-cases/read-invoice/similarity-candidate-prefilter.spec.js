import { describe, expect, it } from 'vitest';
import { MAX_SIMILARITY_CANDIDATES, normalizeSimilarityText, prefilterSimilarityCandidates, } from './similarity-candidate-prefilter.js';
function product(id, description, stockId = 'stock-1') {
    return {
        id, code: `CODE-${id}`, description, stockId,
        quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1,
    };
}
describe('similarity candidate prefilter', () => {
    it('normaliza caixa, acentos, pontuação e whitespace sem apagar medidas', () => {
        expect(normalizeSimilarityText('  PARAFÚSO,  SEXTAVADO---10MM  ')).toBe('parafuso sextavado 10mm');
        expect(normalizeSimilarityText('PARAFUSO 20MM')).not.toBe(normalizeSimilarityText('PARAFUSO 10MM'));
    });
    it('prioriza correspondência lexical e preserva a diferença 10mm vs 20mm', () => {
        const result = prefilterSimilarityCandidates('Parafuso sextavado 10mm', 'stock-1', [
            product('20', 'PARAFUSO SEXTAVADO 20MM'),
            product('10', 'PARAFÚSO, SEXTAVADO 10MM'),
            product('noise', 'ARROZ INTEGRAL'),
        ]);
        expect(result.map(({ id }) => id)).toEqual(['10', '20', 'noise']);
    });
    it('limita catálogo grande, exclui irrelevantes e nunca inclui outro estoque', () => {
        const catalog = [
            ...Array.from({ length: 25 }, (_, index) => product(`relevant-${index}`, `PARAFUSO MODELO ${index}`)),
            product('noise', 'ARROZ INTEGRAL'),
            product('cross-tenant', 'PARAFUSO MODELO EXATO', 'stock-2'),
        ];
        const result = prefilterSimilarityCandidates('PARAFUSO MODELO 7', 'stock-1', catalog);
        expect(result).toHaveLength(MAX_SIMILARITY_CANDIDATES);
        expect(result.some(({ id }) => id === 'noise')).toBe(false);
        expect(result.some(({ id }) => id === 'cross-tenant')).toBe(false);
    });
    it('produz ranking e desempate determinísticos independentemente da ordem do banco', () => {
        const catalog = [
            product('b', 'PARAFUSO ALFA'),
            product('a', 'PARAFUSO ALFA'),
            product('c', 'PARAFUSO BETA'),
            ...Array.from({ length: 20 }, (_, index) => product(`noise-${index}`, `OUTRO ${index}`)),
        ];
        const first = prefilterSimilarityCandidates('PARAFUSO', 'stock-1', catalog).map(({ id }) => id);
        const second = prefilterSimilarityCandidates('PARAFUSO', 'stock-1', [...catalog].reverse()).map(({ id }) => id);
        expect(first).toEqual(second);
        expect(first.slice(0, 2)).toEqual(['a', 'b']);
    });
    it('mantém catálogo pequeno completo e retorna vazio com catálogo grande sem sinal lexical', () => {
        const small = [product('rice', 'ARROZ'), product('beans', 'FEIJAO')];
        expect(prefilterSimilarityCandidates('COMPRESSOR', 'stock-1', small)).toHaveLength(2);
        const large = Array.from({ length: MAX_SIMILARITY_CANDIDATES + 1 }, (_, index) => product(`${index}`, `ALIMENTO ${index}`));
        expect(prefilterSimilarityCandidates('COMPRESSOR INDUSTRIAL', 'stock-1', large)).toEqual([]);
    });
});
//# sourceMappingURL=similarity-candidate-prefilter.spec.js.map