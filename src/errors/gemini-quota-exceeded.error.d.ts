import { AppError } from './app-error.js';
import type { AiUsageLedgerScope } from '../repositories/ai-usage-ledger.repository.js';
/**
 * Estado C do guard de orçamento (P4-02): teto interno de requisições/dia atingido.
 * Escopo `global` responde 503 (capacidade genuinamente indisponível para todos);
 * escopo `user` responde 429 (limite deste cliente, mesma semântica do rate limit já
 * usado nas demais rotas sensíveis). `retryAfterSeconds` é sempre até a virada do período.
 */
export declare class GeminiQuotaExceededError extends AppError {
    readonly scope: AiUsageLedgerScope;
    readonly retryAfterSeconds: number;
    constructor(scope: AiUsageLedgerScope, retryAfterSeconds: number);
}
//# sourceMappingURL=gemini-quota-exceeded.error.d.ts.map