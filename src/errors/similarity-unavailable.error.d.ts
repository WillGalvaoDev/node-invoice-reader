import { AppError } from './app-error.js';
import type { SimilarityUnavailableReason } from '../providers/ai.provider.js';
export declare const SIMILARITY_UNAVAILABLE_MESSAGE = "O servi\u00E7o de an\u00E1lise de similaridade est\u00E1 indispon\u00EDvel no momento. Nenhum dado foi gravado; reenvie a nota mais tarde.";
/**
 * Indisponibilidade do matching por similaridade (P0-02).
 *
 * Distinta de erro de documento (400/422): o DANFE pode estar perfeito e ainda assim
 * não termos evidência confiável para decidir. A nota é abortada antes de qualquer
 * persistência, então o reenvio é sempre possível.
 *
 * `reason` existe para log e telemetria e nunca chega ao cliente — o handler global
 * responde apenas com `message`.
 */
export declare class SimilarityUnavailableError extends AppError {
    readonly reason: SimilarityUnavailableReason;
    constructor(reason: SimilarityUnavailableReason);
}
//# sourceMappingURL=similarity-unavailable.error.d.ts.map