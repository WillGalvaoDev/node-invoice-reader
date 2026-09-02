import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn());
vi.mock('./prisma.js', () => ({ prisma: { aiCallEvent: { create } } }));

const { PrismaAiTelemetry } = await import('./prisma-ai-telemetry.js');
const { recordAiTelemetryBestEffort } = await import('./ai-telemetry.js');

describe('PrismaAiTelemetry', () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({});
  });

  it('persiste todos os campos de contexto em ai_call_events, além do log estruturado', async () => {
    const logRecordCall = vi.fn();
    const telemetry = new PrismaAiTelemetry({ recordCall: logRecordCall, recordSuggestion: vi.fn() });

    await telemetry.recordCall({
      correlationId: 'corr-1', requestId: 'req-1', operation: 'invoice_extraction', model: 'gemini-2.5-flash',
      modelVersion: 'gemini-2.5-flash-001', status: 'success', durationMs: 12.5, attempts: 1,
      inputTokens: 100, outputTokens: 20, totalTokens: 120, estimatedCostUsdNanos: 80_000,
      userId: 'u1', companyId: 'c1', stockId: 's1',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        correlationId: 'corr-1', operation: 'invoice_extraction', model: 'gemini-2.5-flash',
        status: 'success', durationMs: 12.5, attempts: 1,
        requestId: 'req-1', modelVersion: 'gemini-2.5-flash-001',
        inputTokens: 100, outputTokens: 20, totalTokens: 120, estimatedCostUsdNanos: 80_000,
        userId: 'u1', companyId: 'c1', stockId: 's1',
      },
    });
    expect(logRecordCall).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'corr-1' }));
  });

  it('persiste evento de falha só com os campos opcionais presentes, sem inventar os ausentes', async () => {
    const telemetry = new PrismaAiTelemetry({ recordCall: vi.fn(), recordSuggestion: vi.fn() });

    await telemetry.recordCall({
      correlationId: 'corr-2', operation: 'product_similarity', model: 'gemini-2.5-flash',
      status: 'failure', durationMs: 5, attempts: 2, failureCategory: 'timeout',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        correlationId: 'corr-2', operation: 'product_similarity', model: 'gemini-2.5-flash',
        status: 'failure', durationMs: 5, attempts: 2, failureCategory: 'timeout',
      },
    });
  });

  it('recusa persistir sem correlationId, sem gravar placeholder', async () => {
    const telemetry = new PrismaAiTelemetry({ recordCall: vi.fn(), recordSuggestion: vi.fn() });

    await expect(telemetry.recordCall({
      operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1,
    })).rejects.toThrow('correlationId');
    expect(create).not.toHaveBeenCalled();
  });

  it('falha de escrita no banco é best-effort: não propaga e não impede o log', async () => {
    create.mockRejectedValueOnce(new Error('connection lost'));
    const logRecordCall = vi.fn();
    const applicationLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const telemetry = new PrismaAiTelemetry({ recordCall: logRecordCall, recordSuggestion: vi.fn() });

    await expect(recordAiTelemetryBestEffort(
      () => telemetry.recordCall({
        correlationId: 'corr-3', operation: 'invoice_extraction', model: 'gemini-2.5-flash',
        status: 'success', durationMs: 1, attempts: 1,
      }),
      applicationLogger,
      { event: 'ai_operation' },
    )).resolves.toBeUndefined();
    expect(logRecordCall).toHaveBeenCalled();
    expect(applicationLogger.warn).toHaveBeenCalledWith('AI telemetry recording failed', expect.objectContaining({
      event: 'ai_operation',
    }));
  });

  it('recordSuggestion delega ao log-telemetry, sem persistir (P3-02 é escopo futuro)', () => {
    const logRecordSuggestion = vi.fn();
    const telemetry = new PrismaAiTelemetry({ recordCall: vi.fn(), recordSuggestion: logRecordSuggestion });

    telemetry.recordSuggestion({ decision: 'created', confidence: 0.9 });

    expect(logRecordSuggestion).toHaveBeenCalledWith({ decision: 'created', confidence: 0.9 });
    expect(create).not.toHaveBeenCalled();
  });
});
