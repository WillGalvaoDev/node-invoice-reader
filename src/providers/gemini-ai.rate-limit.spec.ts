import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent }; },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN' },
}));
vi.mock('../config/env.js', () => ({ env: {
  GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: 1000, GEMINI_MAX_ATTEMPTS: 2,
  SIMILARITY_CONFIDENCE_THRESHOLD: 0.7, DANFE_MAX_ITEMS: 100,
} }));
const { GeminiAiProvider } = await import('./gemini-ai.provider.js');
const { createErrorHandler } = await import('../middlewares/error-handler.js');

const message = 'O serviço de IA atingiu um limite temporário. Nenhuma alteração desta nota foi aplicada ao estoque. Tente novamente mais tarde.';
const product = { id: 'p1', code: 'A', description: 'Caneta azul', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 's1' };

describe('recusa de cota do provedor na demonstração', () => {
  const telemetry = { recordCall: vi.fn(), recordSuggestion: vi.fn() };
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const budgetGuard = { assertEnabled: vi.fn(), reserveAttempt: vi.fn(), reconcileAttempt: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    budgetGuard.reserveAttempt.mockResolvedValue({ userId: 'demo', reservedAt: '2026-10-10T12:00:00Z' });
    generateContent.mockRejectedValue({ status: 429, message: 'SECRET upstream quota detail' });
  });

  it('extração: responde 503 específico, sem Retry-After inventado, contabiliza uma tentativa e não repete 429', async () => {
    const ai = new GeminiAiProvider({ telemetry, logger, budgetGuard });
    const error = await ai.extractDanfeData(Buffer.from('pdf'), 'application/pdf').catch((e: Error) => e);
    expect(error).toMatchObject({ name: 'GeminiProviderRateLimitError', statusCode: 503, message });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn() };
    createErrorHandler(logger)(error as Error, {} as Request, response as unknown as Response, vi.fn() as NextFunction);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ status: 'error', message });
    expect(response.set).not.toHaveBeenCalled();
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(budgetGuard.reconcileAttempt).toHaveBeenCalledTimes(1);
    expect(telemetry.recordCall).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, status: 'failure', failureCategory: 'provider_rate_limit' }));
  });

  it('similaridade: mantém unavailable com categoria específica, sem converter recusa em produto novo', async () => {
    const ai = new GeminiAiProvider({ telemetry, logger, budgetGuard });
    await expect(ai.findSimilarProduct('Caneta azul', [product])).resolves.toEqual({ kind: 'unavailable', reason: 'provider_rate_limit' });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(budgetGuard.reconcileAttempt).toHaveBeenCalledTimes(1);
    expect(telemetry.recordCall).toHaveBeenCalledWith(expect.objectContaining({ failureCategory: 'provider_rate_limit' }));
  });
});
