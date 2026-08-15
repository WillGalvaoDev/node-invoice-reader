import { AppError } from './app-error.js';
export const SIMILARITY_UNAVAILABLE_MESSAGE = 'O serviço de análise de similaridade está indisponível no momento. Nenhum dado foi gravado; reenvie a nota mais tarde.';
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
export class SimilarityUnavailableError extends AppError {
    reason;
    constructor(reason) {
        super(SIMILARITY_UNAVAILABLE_MESSAGE, 503);
        this.reason = reason;
        this.name = 'SimilarityUnavailableError';
    }
}
//# sourceMappingURL=similarity-unavailable.error.js.map