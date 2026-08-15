import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent }; },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN' },
}));
vi.mock('../config/env.js', () => ({
  env: { GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: 1_000, GEMINI_MAX_ATTEMPTS: 2, SIMILARITY_CONFIDENCE_THRESHOLD: 0.7 },
}));

const { GeminiAiProvider } = await import('./gemini-ai.provider.js');

// P0-02: `provider_failure` não é evidência de `no_match`. Cada uma das situações abaixo
// colapsava em `null`, e o chamador lia ausência de match como "item novo, cadastre".
describe('GeminiAiProvider · classificação do resultado de similaridade (P0-02)', () => {
  const product = {
    id: 'p1', code: 'A', description: 'Produto A', quantity: 1, unitMeasurement: 'UN',
    unitPrice: 1, totalPrice: 1, stockId: 's1',
  };

  beforeEach(() => {
    vi.useRealTimers();
    generateContent.mockReset();
  });

  describe('MATCH — o provedor respondeu e indicou um candidato da lista, acima do limiar', () => {
    it('classifica como match preservando produto, confiança e justificativa', async () => {
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({
        matchFound: true, matchedProductId: 'p1', confidence: 0.9, reason: 'mesmo item',
      }) });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product])).resolves.toEqual({
        kind: 'match', product, confidence: 0.9, reason: 'mesmo item',
      });
    });
  });

  describe('NO_MATCH — o provedor respondeu validamente que não há correspondência', () => {
    it('classifica matchFound=false como no_match', async () => {
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({
        matchFound: false, matchedProductId: '', confidence: 0, reason: 'nenhum equivalente',
      }) });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product])).resolves.toEqual({ kind: 'no_match' });
    });

    it('classifica confiança abaixo do limiar como no_match', async () => {
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({
        matchFound: true, matchedProductId: 'p1', confidence: 0.5, reason: 'incerto',
      }) });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product])).resolves.toEqual({ kind: 'no_match' });
    });

    it('classifica ausência de candidatos como no_match, sem chamar o provedor', async () => {
      await expect(new GeminiAiProvider().findSimilarProduct('A', [])).resolves.toEqual({ kind: 'no_match' });

      expect(generateContent).not.toHaveBeenCalled();
    });
  });

  describe('UNAVAILABLE — não há evidência confiável para concluir no_match', () => {
    it('classifica timeout como unavailable', async () => {
      vi.useFakeTimers();
      generateContent.mockImplementation(({ config }) => new Promise((_resolve, reject) => {
        config.abortSignal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }));

      const pending = new GeminiAiProvider().findSimilarProduct('A', [product]);
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toEqual({ kind: 'unavailable', reason: 'timeout' });
    });

    it('classifica falha 5xx do provedor como unavailable', async () => {
      vi.useFakeTimers();
      generateContent.mockRejectedValue({ status: 503, message: 'upstream detail' });

      const pending = new GeminiAiProvider().findSimilarProduct('A', [product]);
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toEqual({ kind: 'unavailable', reason: 'provider_error' });
    });

    it('classifica JSON inválido como unavailable', async () => {
      generateContent.mockResolvedValueOnce({ text: '{malformed' });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product]))
        .resolves.toEqual({ kind: 'unavailable', reason: 'invalid_response' });
    });

    it('classifica resposta fora do schema como unavailable', async () => {
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({
        matchFound: true, matchedProductId: 'p1', confidence: 2, reason: 'confiança fora da faixa',
      }) });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product]))
        .resolves.toEqual({ kind: 'unavailable', reason: 'invalid_response' });
    });

    it('classifica resposta vazia como unavailable', async () => {
      generateContent.mockResolvedValueOnce({ text: undefined });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product]))
        .resolves.toEqual({ kind: 'unavailable', reason: 'invalid_response' });
    });

    // A defesa de M2-06 contra prompt injection permanece: o ID continua recusado.
    // O que muda é a conclusão — resposta inconfiável não é evidência de item novo.
    it('classifica ID fora da lista de candidatos como unavailable, sem aceitar o ID', async () => {
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({
        matchFound: true,
        matchedProductId: '22222222-2222-4222-8222-222222222222',
        confidence: 0.99,
        reason: 'candidato injetado',
      }) });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [product]))
        .resolves.toEqual({ kind: 'unavailable', reason: 'candidate_not_offered' });
    });

    it('classifica candidato sem identidade persistida como unavailable, não como match', async () => {
      const candidateWithoutId = { code: product.code, description: product.description, quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 's1' };
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({
        matchFound: true, matchedProductId: 'p1', confidence: 0.95, reason: 'id não resolvível',
      }) });

      await expect(new GeminiAiProvider().findSimilarProduct('A', [candidateWithoutId]))
        .resolves.toEqual({ kind: 'unavailable', reason: 'candidate_not_offered' });
    });
  });

  it('nunca devolve null — os três estados são exaustivos e distinguíveis pelo tipo', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({
      matchFound: false, matchedProductId: '', confidence: 0, reason: 'none',
    }) });

    const result = await new GeminiAiProvider().findSimilarProduct('A', [product]);

    expect(result).not.toBeNull();
    expect(['match', 'no_match', 'unavailable']).toContain(result.kind);
  });
});
