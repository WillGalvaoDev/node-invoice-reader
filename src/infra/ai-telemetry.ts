import { logger, type Logger } from './logger.js';

export type AiOperation = 'invoice_extraction' | 'product_similarity';
export type AiFailureCategory = 'timeout' | 'provider_error' | 'invalid_response' | 'unknown';
export type SuggestionTelemetryDecision = 'created' | 'confirmed' | 'rejected';
export type ConfidenceBucket = '0.00-0.49' | '0.50-0.69' | '0.70-0.84' | '0.85-0.94' | '0.95-1.00';

export interface AiCallTelemetryEvent {
  requestId?: string;
  operation: AiOperation;
  model: string;
  modelVersion?: string;
  status: 'success' | 'failure';
  durationMs: number;
  attempts: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsdNanos?: number;
  failureCategory?: AiFailureCategory;
}

export interface AiSuggestionTelemetryEvent {
  decision: SuggestionTelemetryDecision;
  confidence: number;
}

export interface IAiTelemetry {
  recordCall(event: AiCallTelemetryEvent): void;
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

export function createAiTelemetry({ logger: applicationLogger = logger }: { logger?: Logger } = {}): IAiTelemetry {
  return {
    recordCall(event) {
      applicationLogger.info('AI operation observed', { event: 'ai_operation', ...event });
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

export function recordAiTelemetryBestEffort(
  record: () => void,
  applicationLogger: Logger,
  context: Record<string, unknown>,
): void {
  try {
    record();
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
