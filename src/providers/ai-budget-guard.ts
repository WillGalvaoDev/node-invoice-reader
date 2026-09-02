import { env } from '../config/env.js';
import { logger, type Logger } from '../infra/logger.js';
import { hasPricingFor } from '../infra/ai-telemetry.js';
import { AppError } from '../errors/app-error.js';
import { GeminiDisabledError } from '../errors/gemini-disabled.error.js';
import { GeminiQuotaExceededError } from '../errors/gemini-quota-exceeded.error.js';
import type { IAiUsageLedgerRepository } from '../repositories/ai-usage-ledger.repository.js';

/** Segundos até a próxima virada de dia em UTC — nunca zero, para sempre haver `Retry-After` útil. */
function secondsUntilNextUtcMidnight(now: Date): number {
  const nextMidnightMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((nextMidnightMs - now.getTime()) / 1000));
}

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
export class AiBudgetGuard implements IAiBudgetGuard {
  constructor(
    private readonly ledger: IAiUsageLedgerRepository,
    private readonly model: string,
    private readonly now: () => Date = () => new Date(),
    private readonly applicationLogger: Logger = logger,
  ) {}

  /** Pré-condições que não dependem de escopo/usuário — checadas antes de qualquer reserva. */
  assertEnabled(): void {
    if (!env.GEMINI_ENABLED) {
      this.applicationLogger.warn('AI call refused: disabled by operator', { event: 'ai_budget_refusal', state: 'B' });
      throw new GeminiDisabledError();
    }

    if (!hasPricingFor(this.model)) {
      this.applicationLogger.error('AI call refused: model has no pricing entry', {
        event: 'ai_budget_refusal', state: 'fail_closed', model: this.model,
      });
      throw new AppError('Modelo de IA sem tabela de preço configurada — recusado por segurança contábil.', 503);
    }
  }

  /** Reserva uma tentativa (global + usuário). Lança se recusado — o Gemini nunca é chamado. */
  async reserveAttempt(userId: string): Promise<void> {
    const now = this.now();
    const reservation = await this.ledger.reserveRequest(userId, now).catch((error: unknown) => {
      this.applicationLogger.error('AI usage ledger reservation failed', {
        event: 'ai_budget_refusal', state: 'ledger_unavailable',
        error: { name: error instanceof Error ? error.name : 'UnknownError' },
      });
      throw new AppError('O registro de consumo de IA está indisponível; a chamada foi recusada.', 503);
    });

    if (reservation.rejectedScope) {
      const retryAfterSeconds = secondsUntilNextUtcMidnight(now);
      this.applicationLogger.warn('AI call refused: internal daily quota reached', {
        event: 'ai_budget_refusal', state: 'C', scope: reservation.rejectedScope, retryAfterSeconds,
      });
      throw new GeminiQuotaExceededError(reservation.rejectedScope, retryAfterSeconds);
    }
  }

  /**
   * Move a reserva para gasto real. Best-effort **apenas aqui** — a chamada ao Gemini já
   * aconteceu (sucesso ou falha); uma falha nesta contabilização não pode descartar um
   * resultado já obtido. Diferente de `reserveAttempt`, que é sempre fail-closed.
   */
  async reconcileAttempt(userId: string, outcome: AiAttemptOutcome): Promise<void> {
    try {
      await this.ledger.reconcileRequest(userId, this.now(), outcome);
    } catch (error) {
      this.applicationLogger.error('AI usage ledger reconciliation failed', {
        event: 'ai_budget_reconciliation_failure',
        error: { name: error instanceof Error ? error.name : 'UnknownError' },
      });
    }
  }
}

/**
 * Default seguro para injeção (mesmo padrão de `telemetry: IAiTelemetry = aiTelemetry` em
 * `GeminiAiProvider`): nunca toca banco, nunca recusa. Produção sempre injeta explicitamente
 * um `AiBudgetGuard` real (`src/routes.ts`) — este default existe só para não obrigar toda
 * chamada/teste que não se importa com orçamento a conhecer o mecanismo.
 */
export const noopAiBudgetGuard: IAiBudgetGuard = {
  assertEnabled() {},
  async reserveAttempt() {},
  async reconcileAttempt() {},
};
