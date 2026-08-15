import type { IProduct } from '../repositories/product.repository.js';
import type { DanfeMimeType } from '../config/upload.js';
export interface IProductItemResult {
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unitMeasurement: string;
}
export interface ISupplierResult {
    cnpj: string;
    name: string;
    stateRegistration?: string | undefined;
}
export interface IDanfeExtractResult {
    accessKey: string;
    invoiceNumber: string;
    series: string;
    issuedAt: Date;
    totalValue: number;
    supplier: ISupplierResult;
    products: IProductItemResult[];
}
/** Candidato resolvido: só entra em um match quem tem identidade persistida. */
export type ISimilarityCandidate = IProduct & {
    id: string;
};
/**
 * Por que a similaridade ficou indisponível. Serve a log e telemetria — nunca é
 * exposto ao cliente HTTP.
 */
export type SimilarityUnavailableReason = 'timeout' | 'provider_error' | 'invalid_response' | 'candidate_not_offered' | 'unknown';
/**
 * Resultado da tentativa de similaridade. Os três estados são exaustivos e
 * distinguíveis pelo tipo, para que `unavailable` nunca possa ser lido como
 * `no_match`: falha do provedor não é evidência de que o item seja novo.
 */
export type ISimilarityResult = {
    kind: 'match';
    product: ISimilarityCandidate;
    confidence: number;
    reason: string;
} | {
    kind: 'no_match';
} | {
    kind: 'unavailable';
    reason: SimilarityUnavailableReason;
};
export interface IAiProvider {
    extractDanfeData(content: Buffer, mimeType: DanfeMimeType, context?: {
        requestId?: string;
    }): Promise<IDanfeExtractResult>;
    findSimilarProduct(newItemDescription: string, existingProducts: IProduct[], context?: {
        requestId?: string;
    }): Promise<ISimilarityResult>;
}
//# sourceMappingURL=ai.provider.d.ts.map