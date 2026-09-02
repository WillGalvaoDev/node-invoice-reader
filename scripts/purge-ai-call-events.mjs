// P3-03: retenção de ai_call_events (D2, docs/pilot-decisions.md — 60 dias).
// Script de operador, não job automático nesta fase (sem scheduler no Render Free).
//
// Escopo deliberadamente restrito a uma única tabela e uma única condição de idade —
// nunca toca AuditLog (D7: sem purga durante o piloto) nem ai_usage_ledger (P4-02,
// nunca apagado por nenhuma política de retenção). Idempotente por construção: uma
// segunda execução sem linhas elegíveis apaga zero e não falha.
import { prisma, disconnectPrisma } from '../src/infra/prisma.js';

const RETENTION_DAYS = 60;

const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

const { count } = await prisma.aiCallEvent.deleteMany({
  where: { createdAt: { lt: cutoff } },
});

process.stdout.write(
  `ai_call_events: ${count} linha(s) com mais de ${RETENTION_DAYS} dias removida(s) (corte: ${cutoff.toISOString()}).\n`,
);

await disconnectPrisma();
