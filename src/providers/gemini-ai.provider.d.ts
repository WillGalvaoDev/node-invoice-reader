import type { IAiCallContext, IAiProvider, IDanfeExtractResult, ISimilarityResult } from '../providers/ai.provider.js';
import type { IProduct } from '../repositories/product.repository.js';
import { type DanfeMimeType } from '../config/upload.js';
import { type IAiTelemetry } from '../infra/ai-telemetry.js';
import { type Logger } from '../infra/logger.js';
import { type IAiBudgetGuard } from './ai-budget-guard.js';
export declare const GEMINI_MODEL = "gemini-2.5-flash";
export declare class GeminiAiProvider implements IAiProvider {
    private ai;
    private readonly telemetry;
    private readonly budgetGuard;
    private readonly monotonicNow;
    private readonly applicationLogger;
    constructor(options?: {
        telemetry?: IAiTelemetry;
        budgetGuard?: IAiBudgetGuard;
        monotonicNow?: () => number;
        logger?: Logger;
    });
    private generateContent;
    private delay;
    /** Classificação para status/telemetria (502 vs 503) — 429 permanece aqui: é indisponibilidade do provedor, não falha de protocolo. */
    private isTransientError;
    /**
     * Decisão de retry (P4-02, critério 11). Difere de `isTransientError` num único ponto:
     * **429 nunca repete**. Não há forma confiável de distinguir, no corpo/status da resposta,
     * throttling de janela curta (retry ajudaria) de cota diária esgotada (retry só queima mais
     * uma requisição da cota compartilhada). Comportamento conservador registrado na tarefa:
     * nunca repetir 429, custo aceito é perder o retry legítimo de throttling de curta janela.
     */
    private isRetryableError;
    private isNetworkLevelTransient;
    private isTimeoutError;
    private errorStatus;
    private toAppError;
    private failureCategory;
    /** Fonte única de extração de uso — reusada pela telemetria (P3-01) e pela reconciliação do orçamento (P4-02). */
    private usageFromResponse;
    private recordCall;
    private parseJson;
    private parseDanfeResponse;
    private parseSimilarityResponse;
    private toGenerativePart;
    extractDanfeData(content: Buffer, mimeType: DanfeMimeType, context?: IAiCallContext): Promise<IDanfeExtractResult>;
    findSimilarProduct(newItemDescription: string, existingProducts: IProduct[], context?: IAiCallContext): Promise<ISimilarityResult>;
}
//# sourceMappingURL=gemini-ai.provider.d.ts.map