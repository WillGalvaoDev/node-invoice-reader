import { logger } from './logger.js';
// Google Gemini Developer API standard paid tier, verified 2026-08-14.
// https://ai.google.dev/gemini-api/docs/pricing
const MODEL_PRICING = {
    'gemini-2.5-flash': {
        inputUsdNanosPerToken: 300,
        outputUsdNanosPerToken: 2_500,
    },
};
export function calculateGeminiCostUsdNanos(model, inputTokens, outputTokens) {
    const pricing = MODEL_PRICING[model];
    if (!pricing)
        return undefined;
    return inputTokens * pricing.inputUsdNanosPerToken + outputTokens * pricing.outputUsdNanosPerToken;
}
export function confidenceBucket(confidence) {
    if (confidence < 0.5)
        return '0.00-0.49';
    if (confidence < 0.7)
        return '0.50-0.69';
    if (confidence < 0.85)
        return '0.70-0.84';
    if (confidence < 0.95)
        return '0.85-0.94';
    return '0.95-1.00';
}
/**
 * Whitelist positiva do canal de log (stdout): userId/companyId/stockId nunca entram aqui,
 * mesmo que o evento os carregue para persistência em ai_call_events. O mesmo princípio de
 * P3-00B (whitelist > blacklist) aplicado à segunda dimensão sensível deste evento — não
 * credenciais, mas identificadores de tenant que não pertencem a um log best-effort.
 */
function toLoggableCallEvent(event) {
    const { requestId, correlationId, operation, model, modelVersion, status, durationMs, attempts, inputTokens, outputTokens, totalTokens, estimatedCostUsdNanos, failureCategory, } = event;
    return {
        ...(requestId !== undefined && { requestId }),
        ...(correlationId !== undefined && { correlationId }),
        operation, model,
        ...(modelVersion !== undefined && { modelVersion }),
        status, durationMs, attempts,
        ...(inputTokens !== undefined && { inputTokens }),
        ...(outputTokens !== undefined && { outputTokens }),
        ...(totalTokens !== undefined && { totalTokens }),
        ...(estimatedCostUsdNanos !== undefined && { estimatedCostUsdNanos }),
        ...(failureCategory !== undefined && { failureCategory }),
    };
}
export function createAiTelemetry({ logger: applicationLogger = logger } = {}) {
    return {
        recordCall(event) {
            applicationLogger.info('AI operation observed', { event: 'ai_operation', ...toLoggableCallEvent(event) });
        },
        recordSuggestion(event) {
            applicationLogger.info('AI suggestion observed', {
                event: 'ai_suggestion',
                decision: event.decision,
                confidenceBucket: confidenceBucket(event.confidence),
            });
        },
    };
}
export const aiTelemetry = createAiTelemetry();
export async function recordAiTelemetryBestEffort(record, applicationLogger, context) {
    try {
        await record();
    }
    catch (error) {
        try {
            applicationLogger.warn('AI telemetry recording failed', {
                ...context,
                error: { name: error instanceof Error ? error.name : 'UnknownError' },
            });
        }
        catch {
            // Observability must never change the outcome of the business operation.
        }
    }
}
//# sourceMappingURL=ai-telemetry.js.map