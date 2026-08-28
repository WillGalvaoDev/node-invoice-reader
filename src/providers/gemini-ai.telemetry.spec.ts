import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent }; },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN' },
}));
vi.mock('../config/env.js', () => ({
  env: { GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: 1_000, GEMINI_MAX_ATTEMPTS: 2, SIMILARITY_CONFIDENCE_THRESHOLD: 0.7, DANFE_MAX_ITEMS: 100 },
}));

const { GeminiAiProvider } = await import('./gemini-ai.provider.js');

const fileContent = Buffer.from('document');

describe('GeminiAiProvider telemetry', () => {
  const recordCall = vi.fn();
  const telemetry = { recordCall, recordSuggestion: vi.fn() };
  const validDanfe = {
    accessKey: '1'.repeat(44), invoiceNumber: '1', series: '1', issuedAt: '2026-01-01', totalValue: 10,
    supplier: { cnpj: '11222333000181', name: 'Supplier' },
    products: [{ code: 'A', description: 'A', quantity: 1, unitPrice: 10, totalPrice: 10, unitMeasurement: 'UN' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captura usage real, custo e latência monotônica sem estimar tokens', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify(validDanfe),
      modelVersion: 'gemini-2.5-flash-001',
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5, totalTokenCount: 125 },
    });
    const now = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(25);

    await new GeminiAiProvider({ telemetry, monotonicNow: now }).extractDanfeData(
      fileContent, 'image/png', { requestId: 'request-123' },
    );

    expect(recordCall).toHaveBeenCalledWith({
      requestId: 'request-123', operation: 'invoice_extraction', model: 'gemini-2.5-flash', modelVersion: 'gemini-2.5-flash-001', status: 'success',
      durationMs: 15, attempts: 1, inputTokens: 100, outputTokens: 25,
      totalTokens: 125, costUsdNanos: 92_500,
    });
  });

  it('trata usage ausente sem crash e sem fabricar contagens/custo', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(validDanfe) });
    const now = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2);
    await new GeminiAiProvider({ telemetry, monotonicNow: now }).extractDanfeData(fileContent, 'image/png');
    expect(recordCall).toHaveBeenCalledWith(expect.not.objectContaining({ inputTokens: expect.anything() }));
    expect(recordCall).toHaveBeenCalledWith(expect.not.objectContaining({ costUsdNanos: expect.anything() }));
  });

  it('registra falha final e número de tentativas sem mudar retry', async () => {
    vi.useFakeTimers();
    generateContent.mockRejectedValue(Object.assign(new Error('provider payload'), { status: 503 }));
    const now = vi.fn().mockReturnValueOnce(5).mockReturnValueOnce(30);
    const pending = new GeminiAiProvider({ telemetry, monotonicNow: now }).extractDanfeData(fileContent, 'image/png');
    const rejection = expect(pending).rejects.toMatchObject({ statusCode: 503 });
    await vi.runAllTimersAsync();
    await rejection;
    expect(recordCall).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'invoice_extraction', status: 'failure', durationMs: 25,
      attempts: 2, failureCategory: 'provider_error',
    }));
    expect(JSON.stringify(recordCall.mock.calls)).not.toContain('provider payload');
    vi.useRealTimers();
  });

  it('retry recuperado é uma operação bem-sucedida com duas tentativas', async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce(Object.assign(new Error('transient'), { status: 503 }))
      .mockResolvedValueOnce({ text: JSON.stringify(validDanfe) });
    const pending = new GeminiAiProvider({ telemetry, monotonicNow: () => 1 }).extractDanfeData(fileContent, 'image/png');
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ accessKey: validDanfe.accessKey });
    expect(recordCall).toHaveBeenCalledOnce();
    expect(recordCall).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', attempts: 2 }));
    vi.useRealTimers();
  });

  it('distingue similarity de extraction', async () => {
    const product = { id: 'p1', code: 'A', description: 'A', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 's1', userId: null };
    generateContent.mockResolvedValue({ text: JSON.stringify({ matchFound: true, matchedProductId: 'p1', confidence: 0.9, reason: 'similar' }) });
    await new GeminiAiProvider({ telemetry, monotonicNow: () => 1 }).findSimilarProduct('A', [product]);
    expect(recordCall).toHaveBeenCalledWith(expect.objectContaining({ operation: 'product_similarity', status: 'success' }));
  });

  it('falha da telemetria não altera o resultado da extração', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(validDanfe) });
    recordCall.mockImplementationOnce(() => { throw new Error('telemetry unavailable'); });
    await expect(new GeminiAiProvider({ telemetry, monotonicNow: () => 1 }).extractDanfeData(fileContent, 'image/png'))
      .resolves.toMatchObject({ accessKey: validDanfe.accessKey });
  });
});
