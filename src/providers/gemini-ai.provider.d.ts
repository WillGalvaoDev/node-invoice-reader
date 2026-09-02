import type { IAiCallContext, IAiProvider, IDanfeExtractResult, ISimilarityResult } from '../providers/ai.provider.js';
import type { IProduct } from '../repositories/product.repository.js';
import { type DanfeMimeType } from '../config/upload.js';
import { type IAiTelemetry } from '../infra/ai-telemetry.js';
import { type Logger } from '../infra/logger.js';
export declare const GEMINI_MODEL = "gemini-2.5-flash";
export declare class GeminiAiProvider implements IAiProvider {
    private ai;
    private readonly telemetry;
    private readonly monotonicNow;
    private readonly applicationLogger;
    constructor(options?: {
        telemetry?: IAiTelemetry;
        monotonicNow?: () => number;
        logger?: Logger;
    });
    private generateContent;
    private delay;
    private isTransientError;
    private isTimeoutError;
    private errorStatus;
    private toAppError;
    private failureCategory;
    private recordCall;
    private parseJson;
    private parseDanfeResponse;
    private parseSimilarityResponse;
    private toGenerativePart;
    extractDanfeData(content: Buffer, mimeType: DanfeMimeType, context?: IAiCallContext): Promise<IDanfeExtractResult>;
    findSimilarProduct(newItemDescription: string, existingProducts: IProduct[], context?: IAiCallContext): Promise<ISimilarityResult>;
}
//# sourceMappingURL=gemini-ai.provider.d.ts.map