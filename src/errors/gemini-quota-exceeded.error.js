import { AppError } from './app-error.js';
/**
 * Estado C do guard de orçamento (P4-02): teto interno de requisições/dia atingido.
 * Escopo `global` responde 503 (capacidade genuinamente indisponível para todos);
 * escopo `user` responde 429 (limite deste cliente, mesma semântica do rate limit já
 * usado nas demais rotas sensíveis). `retryAfterSeconds` é sempre até a virada do período.
 */
export class GeminiQuotaExceededError extends AppError {
    scope;
    retryAfterSeconds;
    constructor(scope, retryAfterSeconds) {
        super(scope === 'global'
            ? 'A capacidade diária de IA do piloto foi atingida. Tente novamente mais tarde.'
            : 'Você atingiu o limite diário de uso de IA. Tente novamente mais tarde.', scope === 'global' ? 503 : 429);
        this.scope = scope;
        this.retryAfterSeconds = retryAfterSeconds;
        this.name = 'GeminiQuotaExceededError';
    }
}
//# sourceMappingURL=gemini-quota-exceeded.error.js.map