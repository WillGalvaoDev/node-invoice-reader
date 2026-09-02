// P3-04: reconcilia periodicamente ai_usage_ledger (autoritativo, escrita forte) contra
// ai_call_events (observação, best-effort). Somente leitura — nunca escreve em nenhuma
// das duas fontes, nunca corrige nada automaticamente. Reporta; quem decide é o operador.
//
// Grandezas comparadas (derivadas do comportamento real do código, não assumidas):
//   requests: ai_usage_ledger.spentRequests  vs  SUM(ai_call_events.attempts)
//     — NÃO é COUNT(ai_call_events), que conta operações lógicas (uma linha por
//     extractDanfeData/findSimilarProduct), não tentativas HTTP. O ledger debita uma
//     unidade por tentativa (P4-02, critério 12); ai_call_events.attempts já registra
//     quantas tentativas aquela operação fez. SUM(attempts) é a grandeza comparável.
//   tokens: ai_usage_ledger.spentTokens  vs  SUM(ai_call_events.totalTokens)
//   custo:  ai_usage_ledger.spentCostUsdNanos  vs  SUM(ai_call_events.estimatedCostUsdNanos)
//
// Divergências esperadas, não anomalias (documentadas em docs/pilot-readiness-roadmap.md, P3-04):
//   - eventos < ledger: escrita best-effort de ai_call_events perdida (P3-01). Normal em
//     baixo volume; motivo de atenção só se persistente.
//   - eventos > ledger, por uma unidade a mais por chamada: tentativa recusada por cota
//     no meio de um retry (P4-02) incrementa o contador de tentativas do evento antes de
//     a reserva ser recusada e revertida — a tentativa nunca chegou a debitar o ledger.
//     Achado desta tarefa, não estava no desenho original.
//
// Sempre anomalia, independentemente de tolerância:
//   - reservedRequests != 0 num período já fechado (reserva vazada entre reservar e
//     reconciliar — investigar P4-02).
import { prisma, disconnectPrisma } from '../src/infra/prisma.js';

const PERIOD_KIND_DAY = 'day';

function utcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function dayRange(period) {
  const start = new Date(`${period}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Ponto de partida sugerido pela tarefa (5%), com piso de 1 unidade — no volume do
// piloto (teto de 18 requisições/dia), uma tolerância puramente percentual chegaria a
// zero e sinalizaria qualquer perda isolada como anomalia. Recalibrar com dado real do
// piloto (P6-02), não antes.
function tolerance(ledgerValue) {
  return Math.max(1, Math.ceil(Math.abs(ledgerValue) * 0.05));
}

function classifyRequests(spentRequests, reservedRequests, eventsAttempts) {
  if (reservedRequests !== 0) {
    return { anomaly: true, note: `ANOMALIA: reservedRequests=${reservedRequests} residual num período fechado — reserva vazada, investigar P4-02.` };
  }
  const diff = eventsAttempts - spentRequests;
  const tol = tolerance(spentRequests);
  if (diff === 0) return { anomaly: false, note: 'reconciliado.' };
  if (diff > 0 && diff <= tol) return { anomaly: false, note: `dentro da tolerância (+${diff}) — possivelmente tentativa recusada por cota no meio de um retry.` };
  if (diff < 0 && -diff <= tol) return { anomaly: false, note: `dentro da tolerância (${diff}) — possível perda best-effort de ai_call_events.` };
  if (diff > 0) return { anomaly: true, note: `ATENÇÃO: eventos > ledger além da tolerância (+${diff}). Investigar: correlationId específicos com mais tentativas do que o ledger debitou (consumo fora do guard, ou múltiplas rejeições de cota).` };
  return { anomaly: true, note: `ATENÇÃO: eventos < ledger além da tolerância (${diff}). Possível perda best-effort persistente de ai_call_events — investigar volume de falha de escrita.` };
}

function classifySum(label, ledgerValue, eventsValue) {
  const diff = eventsValue - ledgerValue;
  const tol = tolerance(ledgerValue);
  if (diff === 0) return { anomaly: false, note: `${label}: reconciliado.` };
  if (Math.abs(diff) <= tol) return { anomaly: false, note: `${label}: dentro da tolerância (${diff >= 0 ? '+' : ''}${diff}).` };
  return { anomaly: true, note: `ATENÇÃO: ${label} diverge além da tolerância (${diff >= 0 ? '+' : ''}${diff}).` };
}

async function reconcilePeriod(period) {
  const { start, end } = dayRange(period);
  const ledgerRows = await prisma.aiUsageLedger.findMany({
    where: { periodKind: PERIOD_KIND_DAY, period },
    orderBy: [{ scope: 'asc' }, { scopeId: 'asc' }],
  });

  if (ledgerRows.length === 0) {
    process.stdout.write(`Nenhuma atividade em ai_usage_ledger para ${period} (período: ${PERIOD_KIND_DAY}).\n`);
    return { anomalyCount: 0 };
  }

  let anomalyCount = 0;

  for (const row of ledgerRows) {
    const where = row.scope === 'global'
      ? { createdAt: { gte: start, lt: end } }
      : { createdAt: { gte: start, lt: end }, userId: row.scopeId };

    const aggregate = await prisma.aiCallEvent.aggregate({
      where,
      _count: true,
      _sum: { attempts: true, totalTokens: true, estimatedCostUsdNanos: true },
    });

    const eventsAttempts = aggregate._sum.attempts ?? 0;
    const eventsTokens = aggregate._sum.totalTokens ?? 0;
    const eventsCost = aggregate._sum.estimatedCostUsdNanos ?? 0;

    const requestsClassification = classifyRequests(row.spentRequests, row.reservedRequests, eventsAttempts);
    const tokensClassification = classifySum('tokens', row.spentTokens, eventsTokens);
    const costClassification = classifySum('custo estimado (nanoUSD)', row.spentCostUsdNanos, eventsCost);

    process.stdout.write(`\n--- ${row.scope}:${row.scopeId} — ${period} ---\n`);
    process.stdout.write(`  ai_call_events: ${aggregate._count} linha(s), attempts=${eventsAttempts}, totalTokens=${eventsTokens}, estimatedCostUsdNanos=${eventsCost}\n`);
    process.stdout.write(`  ai_usage_ledger: spentRequests=${row.spentRequests}, reservedRequests=${row.reservedRequests}, spentTokens=${row.spentTokens}, spentCostUsdNanos=${row.spentCostUsdNanos}\n`);
    process.stdout.write(`  requests: ${requestsClassification.note}\n`);
    process.stdout.write(`  ${tokensClassification.note}\n`);
    process.stdout.write(`  ${costClassification.note}\n`);

    if (requestsClassification.anomaly) anomalyCount += 1;
    if (tokensClassification.anomaly) anomalyCount += 1;
    if (costClassification.anomaly) anomalyCount += 1;
  }

  return { anomalyCount };
}

const requestedDate = process.argv[2];
// Default: ontem (UTC) — um período já fechado. Reconciliar "hoje" produziria falso
// positivo de "reserva residual" para uploads genuinamente em andamento.
const targetDate = requestedDate ? new Date(`${requestedDate}T00:00:00.000Z`) : new Date(Date.now() - 24 * 60 * 60 * 1000);
if (Number.isNaN(targetDate.getTime())) {
  throw new Error('Data inválida. Use --date já resolvido como YYYY-MM-DD (ex.: node scripts/reconcile-ai-usage.mjs 2026-09-02).');
}
const period = utcDayKey(targetDate);

const { anomalyCount } = await reconcilePeriod(period);

process.stdout.write(`\nLembrete manual (sem API documentada para automatizar): confirme no console do Google que o faturamento do projeto continua zero (D4/D8), e confira a cota/uso real no AI Studio para ${period}.\n`);

if (anomalyCount > 0) {
  process.stdout.write(`\n${anomalyCount} anomalia(s) encontrada(s) em ${period}. Nada foi corrigido — este script é somente leitura.\n`);
} else {
  process.stdout.write(`\nNenhuma anomalia em ${period}.\n`);
}

await disconnectPrisma();
process.exitCode = anomalyCount > 0 ? 1 : 0;
