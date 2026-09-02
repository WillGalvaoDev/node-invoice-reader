import { logger, type Logger } from './logger.js';

export type AiOperation = 'invoice_extraction' | 'product_similarity';
export type AiFailureCategory = 'timeout' | 'provider_error' | 'invalid_response' | 'unknown';
export type SuggestionTelemetryDecision = 'created' | 'confirmed' | 'rejected';
export type ConfidenceBucket = '0.00-0.49' | '0.50-0.69' | '0.70-0.84' | '0.85-0.94' | '0.95-1.00';

export interface AiCallTelemetryEvent {
  requestId?: string;
  correlationId?: string;
  operation: AiOperation;
  model: string;
  modelVersion?: string;
  status: 'success' | 'failure';
  durationMs: number;
  attempts: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  // Estimado, nunca faturado: sob Free Tier o custo real é zero (D4). Nunca apresentar como cobrança.
  estimatedCostUsdNanos?: number;
  failureCategory?: AiFailureCategory;
  // Contexto de correlação para persistência (P3-01). Deliberadamente EXCLUÍDO do canal de
  // log estruturado (ver createAiTelemetry abaixo) — vai só para ai_call_events, sob as
  // mesmas regras de acesso do banco, nunca para stdout.
  userId?: string;
  companyId?: string;
  stockId?: string;
}

export interface AiSuggestionTelemetryEvent {
  decision: SuggestionTelemetryDecision;
  confidence: number;
}

export interface IAiTelemetry {
  // Assíncrono para permitir implementações que persistem em banco (P3-01: PrismaAiTelemetry).
  // Sempre invocado através de recordAiTelemetryBestEffort, nunca sem await, no call site.
  recordCall(event: AiCallTelemetryEvent): void | Promise<void>;
  recordSuggestion(event: AiSuggestionTelemetryEvent): void;
}

interface ModelPricing {
  inputUsdNanosPerToken: number;
  outputUsdNanosPerToken: number;
}

// Google Gemini Developer API standard paid tier, verified 2026-08-14.
// https://ai.google.dev/gemini-api/docs/pricing
const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  'gemini-2.5-flash': {
    inputUsdNanosPerToken: 300,
    outputUsdNanosPerToken: 2_500,
  },
};

/** Fail-closed do guard de orçamento (P4-02): um modelo sem preço não deve ser chamado. */
export function hasPricingFor(model: string): boolean {
  return model in MODEL_PRICING;
}

export function calculateGeminiCostUsdNanos(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return undefined;
  return inputTokens * pricing.inputUsdNanosPerToken + outputTokens * pricing.outputUsdNanosPerToken;
}

export function confidenceBucket(confidence: number): ConfidenceBucket {
  if (confidence < 0.5) return '0.00-0.49';
  if (confidence < 0.7) return '0.50-0.69';
  if (confidence < 0.85) return '0.70-0.84';
  if (confidence < 0.95) return '0.85-0.94';
  return '0.95-1.00';
}

/**
 * Whitelist positiva do canal de log (stdout): userId/companyId/stockId nunca entram aqui,
 * mesmo que o evento os carregue para persistência em ai_call_events. O mesmo princípio de
 * P3-00B (whitelist > blacklist) aplicado à segunda dimensão sensível deste evento — não
 * credenciais, mas identificadores de tenant que não pertencem a um log best-effort.
 */
function toLoggableCallEvent(event: AiCallTelemetryEvent): Record<string, unknown> {
  const {
    requestId, correlationId, operation, model, modelVersion, status,
    durationMs, attempts, inputTokens, outputTokens, totalTokens,
    estimatedCostUsdNanos, failureCategory,
  } = event;
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

export function createAiTelemetry({ logger: applicationLogger = logger }: { logger?: Logger } = {}): IAiTelemetry {
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

export async function recordAiTelemetryBestEffort(
  record: () => void | Promise<void>,
  applicationLogger: Logger,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    await record();
  } catch (error) {
    try {
      applicationLogger.warn('AI telemetry recording failed', {
        ...context,
        error: { name: error instanceof Error ? error.name : 'UnknownError' },
      });
    } catch {
      // Observability must never change the outcome of the business operation.
    }
  }
}
