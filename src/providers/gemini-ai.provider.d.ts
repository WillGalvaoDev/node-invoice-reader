import type { IAiProvider, IDanfeExtractResult, ISimilarityMatch } from '../providers/ai.provider.js';
import type { IProduct } from '../repositories/product.repository.js';
import { type DanfeMimeType } from '../config/upload.js';
export declare class GeminiAiProvider implements IAiProvider {
    private ai;
    constructor();
    private generateContent;
    private delay;
    private isTransientError;
    private isTimeoutError;
    private errorStatus;
    private toAppError;
    private parseJson;
    private parseDanfeResponse;
    private parseSimilarityResponse;
    private fileToGenerativePart;
    extractDanfeData(filePath: string, mimeType: DanfeMimeType): Promise<IDanfeExtractResult>;
    findSimilarProduct(newItemDescription: string, existingProducts: IProduct[]): Promise<ISimilarityMatch | null>;
}
//# sourceMappingURL=gemini-ai.provider.d.ts.map