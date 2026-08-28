import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent }; },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN' },
}));
// Limiar deliberadamente diferente do default (0.7) para provar que prompt e decisão em
// código derivam da mesma fonte configurada (M6-02), não de um "0.70" hardcoded em dois lugares.
vi.mock('../config/env.js', () => ({
  env: { GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: 1_000, GEMINI_MAX_ATTEMPTS: 2, SIMILARITY_CONFIDENCE_THRESHOLD: 0.85, DANFE_MAX_ITEMS: 100 },
}));

const { GeminiAiProvider } = await import('./gemini-ai.provider.js');

describe('GeminiAiProvider limiar de confiança configurável (M6-02)', () => {
  const product = {
    id: 'p1', code: 'A', description: 'Produto A', quantity: 1, unitMeasurement: 'UN',
    unitPrice: 1, totalPrice: 1, stockId: 's1',
  };

  beforeEach(() => {
    vi.useRealTimers();
    generateContent.mockReset();
  });

  it('interpola o limiar configurado (0.85) no system instruction, não o default 0.70', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({
      matchFound: false, matchedProductId: '', confidence: 0, reason: 'none',
    }) });

    await new GeminiAiProvider().findSimilarProduct('Produto', [product]);

    const systemInstruction = generateContent.mock.calls[0]?.[0].config.systemInstruction as string;
    expect(systemInstruction).toContain('0.85');
    expect(systemInstruction).not.toContain('0.70');
  });

  it('usa o limiar configurado (0.85), não o default 0.70, para decidir match', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({
      matchFound: true, matchedProductId: 'p1', confidence: 0.8, reason: 'abaixo do limiar configurado',
    }) });
    // Abaixo do limiar e no_match legitimo: o modelo respondeu e a politica e nossa.
    await expect(new GeminiAiProvider().findSimilarProduct('Produto', [product]))
      .resolves.toEqual({ kind: 'no_match' });

    generateContent.mockResolvedValueOnce({ text: JSON.stringify({
      matchFound: true, matchedProductId: 'p1', confidence: 0.9, reason: 'acima do limiar configurado',
    }) });
    await expect(new GeminiAiProvider().findSimilarProduct('Produto', [product]))
      .resolves.toMatchObject({ product, confidence: 0.9 });
  });
});
