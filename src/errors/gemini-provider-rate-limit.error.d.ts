import { AppError } from './app-error.js';
export declare const GEMINI_PROVIDER_RATE_LIMIT_MESSAGE = "O servi\u00E7o de IA atingiu um limite tempor\u00E1rio. Nenhuma altera\u00E7\u00E3o desta nota foi aplicada ao estoque. Tente novamente mais tarde.";
/** Recusa da dependência compartilhada, sem inferir duração ou dimensão da cota. */
export declare class GeminiProviderRateLimitError extends AppError {
    constructor();
}
//# sourceMappingURL=gemini-provider-rate-limit.error.d.ts.map