import { type Logger } from './logger.js';
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
export declare function calculateGeminiCostUsdNanos(model: string, inputTokens: number, outputTokens: number): number | undefined;
export declare function confidenceBucket(confidence: number): ConfidenceBucket;
export declare function createAiTelemetry({ logger: applicationLogger }?: {
    logger?: Logger;
}): IAiTelemetry;
export declare const aiTelemetry: IAiTelemetry;
export declare function recordAiTelemetryBestEffort(record: () => void, applicationLogger: Logger, context: Record<string, unknown>): void;
//# sourceMappingURL=ai-telemetry.d.ts.map