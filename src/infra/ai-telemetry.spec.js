import { describe, expect, it, vi } from 'vitest';
import { calculateGeminiCostUsdNanos, confidenceBucket, createAiTelemetry, recordAiTelemetryBestEffort, } from './ai-telemetry.js';
describe('AI telemetry', () => {
    it.each([
        [0, 0, 0],
        [1_000_000, 0, 300_000_000],
        [0, 1_000_000, 2_500_000_000],
        [1_000, 500, 1_550_000],
    ])('calcula custo determinístico em USD nanos para input=%d output=%d', (input, output, expected) => {
        expect(calculateGeminiCostUsdNanos('gemini-2.5-flash', input, output)).toBe(expected);
    });
    it('torna pricing desconhecido explicitamente indisponível', () => {
        expect(calculateGeminiCostUsdNanos('unknown-model', 100, 100)).toBeUndefined();
    });
    it.each([
        [0, '0.00-0.49'], [0.49, '0.00-0.49'], [0.5, '0.50-0.69'],
        [0.7, '0.70-0.84'], [0.85, '0.85-0.94'], [0.95, '0.95-1.00'], [1, '0.95-1.00'],
    ])('classifica confidence %d em bucket estável', (confidence, expected) => {
        expect(confidenceBucket(confidence)).toBe(expected);
    });
    it('emite eventos estruturados sem dimensões sensíveis ou alta cardinalidade', () => {
        const info = vi.fn();
        const telemetry = createAiTelemetry({
            logger: { debug: vi.fn(), info, warn: vi.fn(), error: vi.fn() },
        });
        telemetry.recordCall({
            operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success',
            durationMs: 12.5, attempts: 1, inputTokens: 100, outputTokens: 20,
            totalTokens: 120, costUsdNanos: 80_000,
        });
        telemetry.recordSuggestion({ decision: 'created', confidence: 0.88 });
        expect(info).toHaveBeenNthCalledWith(1, 'AI operation observed', expect.objectContaining({
            event: 'ai_operation', operation: 'invoice_extraction', status: 'success', inputTokens: 100,
        }));
        expect(info).toHaveBeenNthCalledWith(2, 'AI suggestion observed', {
            event: 'ai_suggestion', decision: 'created', confidenceBucket: '0.85-0.94',
        });
        const serialized = JSON.stringify(info.mock.calls);
        expect(serialized).not.toMatch(/accessKey|cnpj|description|prompt|response|userId|companyId|stockId/i);
    });
    it('keeps best-effort when recorder and logger both fail', () => {
        const failingLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: () => { throw new Error('logger unavailable'); },
            error: vi.fn(),
        };
        expect(() => recordAiTelemetryBestEffort(() => { throw new Error('telemetry unavailable'); }, failingLogger, { event: 'ai_operation' })).not.toThrow();
    });
});
//# sourceMappingURL=ai-telemetry.spec.js.map