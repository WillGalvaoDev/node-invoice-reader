import { AppError } from './app-error.js';
export declare const GEMINI_DISABLED_MESSAGE = "O servi\u00E7o de IA est\u00E1 desabilitado pelo operador no momento.";
/**
 * Estado B do kill switch (P4-02): `GEMINI_ENABLED=false`. Distinto de esgotamento de cota
 * (estado C) — não há `Retry-After`, porque não há previsão de retorno; é decisão humana,
 * não janela de tempo.
 */
export declare class GeminiDisabledError extends AppError {
    constructor();
}
//# sourceMappingURL=gemini-disabled.error.d.ts.map