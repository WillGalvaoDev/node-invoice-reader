/**
 * Registro autoritativo de consumo de Gemini (P4-02, D8). Decide se uma chamada pode
 * acontecer — nunca best-effort, ao contrário de `ai_call_events` (P3-01). Nenhuma leitura
 * de `ai_call_events` participa desta decisão.
 */
export type AiUsageLedgerScope = 'global' | 'user';

/** Qual escopo excedeu o teto — ausente significa reserva aceita. */
export interface AiUsageLedgerReservation {
  rejectedScope?: AiUsageLedgerScope;
}

export interface AiUsageLedgerReconciliation {
  tokens?: number;
  costUsdNanos?: number;
}

export interface IAiUsageLedgerRepository {
  /**
   * Reserva atomicamente uma requisição em ambos os escopos (global e do usuário) para o
   * período corrente. Se qualquer um dos dois exceder seu teto, nenhuma reserva é mantida
   * (tudo ou nada) — implementações devem garantir isso com uma transação real, não com
   * decremento manual best-effort.
   */
  reserveRequest(userId: string, now: Date): Promise<AiUsageLedgerReservation>;

  /**
   * Move a reserva de +1 requisição (ambos os escopos) para "gasto", somando o consumo real
   * de tokens/custo quando disponível. Chamado após toda tentativa que chegou a reservar,
   * sucesso ou falha — nunca para uma reserva que foi recusada (essa já não deixou rastro).
   */
  reconcileRequest(userId: string, now: Date, usage: AiUsageLedgerReconciliation): Promise<void>;
}
