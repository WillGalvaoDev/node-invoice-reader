import { type Logger } from '../infra/logger.js';
import type { IAiUsageLedgerRepository } from '../repositories/ai-usage-ledger.repository.js';
export interface AiAttemptOutcome {
    tokens?: number;
    costUsdNanos?: number;
}
export interface IAiBudgetGuard {
    assertEnabled(): void;
    reserveAttempt(userId: string): Promise<void>;
    reconcileAttempt(userId: string, outcome: AiAttemptOutcome): Promise<void>;
}
/**
 * Guard de orçamento Gemini (P4-02, D8). Fail-closed: nenhuma chamada ao provedor acontece
 * sem reserva aceita no `ai_usage_ledger`. Nunca lê `ai_call_events` para decidir nada.
 */
export declare class AiBudgetGuard implements IAiBudgetGuard {
    private readonly ledger;
    private readonly model;
    private readonly now;
    private readonly applicationLogger;
    constructor(ledger: IAiUsageLedgerRepository, model: string, now?: () => Date, applicationLogger?: Logger);
    /** Pré-condições que não dependem de escopo/usuário — checadas antes de qualquer reserva. */
    assertEnabled(): void;
    /** Reserva uma tentativa (global + usuário). Lança se recusado — o Gemini nunca é chamado. */
    reserveAttempt(userId: string): Promise<void>;
    /**
     * Move a reserva para gasto real. Best-effort **apenas aqui** — a chamada ao Gemini já
     * aconteceu (sucesso ou falha); uma falha nesta contabilização não pode descartar um
     * resultado já obtido. Diferente de `reserveAttempt`, que é sempre fail-closed.
     */
    reconcileAttempt(userId: string, outcome: AiAttemptOutcome): Promise<void>;
}
/**
 * Default seguro para injeção (mesmo padrão de `telemetry: IAiTelemetry = aiTelemetry` em
 * `GeminiAiProvider`): nunca toca banco, nunca recusa. Produção sempre injeta explicitamente
 * um `AiBudgetGuard` real (`src/routes.ts`) — este default existe só para não obrigar toda
 * chamada/teste que não se importa com orçamento a conhecer o mecanismo.
 */
export declare const noopAiBudgetGuard: IAiBudgetGuard;
//# sourceMappingURL=ai-budget-guard.d.ts.map