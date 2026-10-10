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
const { GeminiDisabledError } = await import('../errors/gemini-disabled.error.js');
const { GeminiQuotaExceededError } = await import('../errors/gemini-quota-exceeded.error.js');

const fileContent = Buffer.from('document');
const validDanfe = {
  accessKey: '1'.repeat(44), invoiceNumber: '1', series: '1', issuedAt: '2026-01-01', totalValue: 10,
  supplier: { cnpj: '11222333000181', name: 'Supplier' },
  products: [{ code: 'A', description: 'A', quantity: 1, unitPrice: 10, totalPrice: 10, unitMeasurement: 'UN' }],
};

describe('GeminiAiProvider × AiBudgetGuard (P4-02)', () => {
  const budgetGuard = { assertEnabled: vi.fn(), reserveAttempt: vi.fn(), reconcileAttempt: vi.fn() };
  const reservation = { userId: 'user-1', reservedAt: '2026-10-10T12:00:00.000Z' };

  beforeEach(() => {
    vi.resetAllMocks();
    generateContent.mockResolvedValue({ text: JSON.stringify(validDanfe) });
    budgetGuard.reserveAttempt.mockImplementation(async (userId: string) => ({ ...reservation, userId }));
    budgetGuard.reconcileAttempt.mockResolvedValue(undefined);
  });

  it('checa o kill switch/preço antes de qualquer reserva ou chamada ao Gemini', async () => {
    budgetGuard.assertEnabled.mockImplementationOnce(() => { throw new GeminiDisabledError(); });

    await expect(new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png'))
      .rejects.toBeInstanceOf(GeminiDisabledError);

    expect(budgetGuard.reserveAttempt).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('reserva antes de cada tentativa — nunca chama o Gemini sem reserva aceita', async () => {
    await new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' });

    expect(budgetGuard.reserveAttempt).toHaveBeenCalledWith('user-1');
    expect(budgetGuard.reserveAttempt).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('rejeição na reserva impede a chamada ao Gemini — nenhum retry, propaga o erro do guard', async () => {
    budgetGuard.reserveAttempt.mockRejectedValueOnce(new GeminiQuotaExceededError('global', 3600));

    await expect(new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' }))
      .rejects.toBeInstanceOf(GeminiQuotaExceededError);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('cada tentativa de um retry reserva de novo — 2 tentativas debitam 2 (critério 12)', async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce({ status: 503, message: 'transient' })
      .mockResolvedValueOnce({ text: JSON.stringify(validDanfe) });

    const pending = new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' });
    await vi.runAllTimersAsync();
    await pending;

    expect(budgetGuard.reserveAttempt).toHaveBeenCalledTimes(2);
    expect(budgetGuard.reconcileAttempt).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('reconcilia cada retry com seu próprio contexto de reserva, inclusive atravessando meia-noite', async () => {
    vi.useFakeTimers();
    const first = { userId: 'user-1', reservedAt: '2026-10-10T23:59:59.000Z' };
    const second = { userId: 'user-1', reservedAt: '2026-10-11T00:00:01.000Z' };
    budgetGuard.reserveAttempt.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    generateContent.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ text: JSON.stringify(validDanfe) });
    const pending = new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' });
    await vi.runAllTimersAsync();
    await pending;
    expect(budgetGuard.reconcileAttempt.mock.calls.map(([reservation]) => reservation)).toEqual([first, second]);
    vi.useRealTimers();
  });

  it('uma rejeição de cota NO MEIO do retry aborta sem terceira tentativa nem novo reconcile', async () => {
    vi.useFakeTimers();
    generateContent.mockRejectedValueOnce({ status: 503, message: 'transient' });
    budgetGuard.reserveAttempt
      .mockResolvedValueOnce(reservation)
      .mockRejectedValueOnce(new GeminiQuotaExceededError('user', 60));

    const pending = new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' });
    const assertion = expect(pending).rejects.toBeInstanceOf(GeminiQuotaExceededError);
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(1); // só a 1ª tentativa chegou a chamar o Gemini
    expect(budgetGuard.reconcileAttempt).toHaveBeenCalledTimes(1); // só reconcilia a tentativa que realmente ocorreu
    vi.useRealTimers();
  });

  it('reconcilia com os tokens reais da resposta em caso de sucesso', async () => {
    vi.useRealTimers();
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify(validDanfe),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 },
    });

    await new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' });

    expect(budgetGuard.reconcileAttempt).toHaveBeenCalledWith(reservation, expect.objectContaining({ tokens: 120 }));
  });

  it('reconcilia com outcome vazio em caso de falha (tokens ausentes não viram zero fabricado)', async () => {
    generateContent.mockRejectedValue({ status: 401, message: 'permanent' }); // não-retryable: nem 429, nem 5xx

    await expect(new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png', { userId: 'user-1' }))
      .rejects.toMatchObject({ statusCode: 502 });

    expect(budgetGuard.reconcileAttempt).toHaveBeenCalledWith(reservation, {});
  });

  it('sem context/userId, usa string vazia como escopo (nunca lança por falta de contexto) — default seguro para chamadores que não configuram orçamento', async () => {
    await expect(new GeminiAiProvider({ budgetGuard }).extractDanfeData(fileContent, 'image/png')).resolves.toBeDefined();
    expect(budgetGuard.reserveAttempt).toHaveBeenCalledWith('');
  });

  it('findSimilarProduct também passa pelo guard, com o mesmo userId', async () => {
    const product = { id: 'p1', code: 'A', description: 'A', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 's1' };
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ matchFound: false, matchedProductId: '', confidence: 0, reason: 'none' }) });

    await new GeminiAiProvider({ budgetGuard }).findSimilarProduct('A', [product], { userId: 'user-2' });

    expect(budgetGuard.reserveAttempt).toHaveBeenCalledWith('user-2');
  });
});
