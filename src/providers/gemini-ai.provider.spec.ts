import { beforeEach, describe, expect, it, vi } from 'vitest';

const readFile = vi.hoisted(() => vi.fn());
const generateContent = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ default: { readFile }, readFile }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent }; },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN' },
}));
vi.mock('../config/env.js', () => ({
  env: { GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: 1_000, GEMINI_MAX_ATTEMPTS: 2 },
}));

const { GeminiAiProvider } = await import('./gemini-ai.provider.js');

describe('GeminiAiProvider file MIME', () => {
  const validDanfe = {
    accessKey: '1'.repeat(44), invoiceNumber: '1', series: '1', issuedAt: '2026-01-01', totalValue: 10,
    supplier: { cnpj: '1', name: 'Supplier' },
    products: [{ code: 'A', description: 'A', quantity: 1, unitPrice: 10, totalPrice: 10, unitMeasurement: 'UN' }],
  };

  beforeEach(() => {
    vi.useRealTimers();
    readFile.mockReset();
    generateContent.mockReset();
    readFile.mockResolvedValue(Buffer.from('document'));
    generateContent.mockResolvedValue({ text: JSON.stringify(validDanfe) });
  });

  it.each(['image/jpeg', 'image/png', 'application/pdf'] as const)('envia bytes de %s com o MIME recebido', async (mimeType) => {
    await new GeminiAiProvider().extractDanfeData('tmp/hash-without-extension', mimeType);

    expect(readFile).toHaveBeenCalledWith('tmp/hash-without-extension');
    expect(generateContent.mock.calls[0]?.[0].contents[1].inlineData).toEqual({
      data: Buffer.from('document').toString('base64'),
      mimeType,
    });
  });

  it('rejeita MIME desconhecido sem fallback para JPEG nem chamada externa', async () => {
    await expect(new GeminiAiProvider().extractDanfeData('tmp/hash', 'application/zip' as any))
      .rejects.toMatchObject({ statusCode: 415 });

    expect(readFile).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('nao usa readFileSync no provider', async () => {
    const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const source = await fs.readFile(new URL('./gemini-ai.provider.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('readFileSync');
  });

  it('cancela cada tentativa no timeout e rejeita sem espera indefinida', async () => {
    vi.useFakeTimers();
    const observedSignals: AbortSignal[] = [];
    generateContent.mockImplementation(({ config }) => new Promise((_resolve, reject) => {
      observedSignals.push(config.abortSignal);
      config.abortSignal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));

    const pending = new GeminiAiProvider().extractDanfeData('tmp/hash', 'image/png');
    const assertion = expect(pending).rejects.toMatchObject({ statusCode: 504 });
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(observedSignals).toHaveLength(2);
    expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
  });

  it.each([429, 500, 503])('repete status transitório %s e retorna o sucesso posterior', async (status) => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce({ status, message: 'upstream detail' })
      .mockResolvedValueOnce({ text: JSON.stringify(validDanfe) });

    const pending = new GeminiAiProvider().extractDanfeData('tmp/hash', 'image/png');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({ accessKey: validDanfe.accessKey });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('respeita o limite de tentativas para falha transitória', async () => {
    vi.useFakeTimers();
    generateContent.mockRejectedValue({ status: 503, message: 'sensitive upstream body' });

    const pending = new GeminiAiProvider().extractDanfeData('tmp/hash', 'image/png');
    const assertion = expect(pending).rejects.toMatchObject({
      statusCode: 503,
      message: expect.not.stringContaining('sensitive upstream body'),
    });
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('nao repete erro permanente', async () => {
    generateContent.mockRejectedValueOnce({ status: 401, message: 'api-key-value' });

    await expect(new GeminiAiProvider().extractDanfeData('tmp/hash', 'image/png')).rejects.toMatchObject({
      statusCode: 502,
      message: expect.not.stringContaining('api-key-value'),
    });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it.each([
    ['resposta vazia', undefined],
    ['texto sem JSON', 'not json'],
    ['JSON malformado', '{"products":'],
  ])('mapeia %s para erro previsível sem retry', async (_case, text) => {
    generateContent.mockResolvedValueOnce({ text });

    const error = await new GeminiAiProvider().extractDanfeData('tmp/hash', 'image/png').catch((caught) => caught);

    expect(error).toMatchObject({ statusCode: 422 });
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it('rejeita estrutura minima incompatível', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ accessKey: '1'.repeat(44), products: {} }) });

    await expect(new GeminiAiProvider().extractDanfeData('tmp/hash', 'image/png'))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it('preserva matching valido e degrada resposta invalida para null sem retry', async () => {
    const product = { id: 'p1', code: 'A', description: 'A', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 's1' };
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({
      matchFound: true, matchedProductId: 'p1', confidence: 0.9, reason: 'same',
    }) });

    await expect(new GeminiAiProvider().findSimilarProduct('A', [product])).resolves.toMatchObject({ product, confidence: 0.9 });

    generateContent.mockResolvedValueOnce({ text: '{malformed' });
    await expect(new GeminiAiProvider().findSimilarProduct('A', [product])).resolves.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
