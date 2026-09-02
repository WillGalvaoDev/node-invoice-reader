import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { PrismaAiUsageLedgerRepository } from '../../src/repositories/prisma-ai-usage-ledger.repository.js';
const repository = new PrismaAiUsageLedgerRepository();
const PERIOD_KIND_DAY = 'day';
const GLOBAL_SCOPE_ID = 'global';
function dayPeriod(date) {
    return date.toISOString().slice(0, 10);
}
async function seedLedgerRow(scope, scopeId, period, overrides = {}) {
    return prisma.aiUsageLedger.create({
        data: { scope, scopeId, periodKind: PERIOD_KIND_DAY, period, reservedRequests: 0, spentRequests: 0, ...overrides },
    });
}
beforeEach(async () => {
    await prisma.aiUsageLedger.deleteMany();
});
afterAll(disconnectPrisma);
describe('PostgreSQL Integration Gate — ai_usage_ledger (P4-02, D8)', () => {
    it('reserva aceita quando abaixo do teto, e reconcilia movendo reserved -> spent com tokens/custo reais', async () => {
        const now = new Date();
        const reservation = await repository.reserveRequest('user-1', now);
        expect(reservation.rejectedScope).toBeUndefined();
        const period = dayPeriod(now);
        const globalBeforeReconcile = await prisma.aiUsageLedger.findUniqueOrThrow({
            where: { scope_scopeId_periodKind_period: { scope: 'global', scopeId: GLOBAL_SCOPE_ID, periodKind: PERIOD_KIND_DAY, period } },
        });
        expect(globalBeforeReconcile).toMatchObject({ reservedRequests: 1, spentRequests: 0 });
        await repository.reconcileRequest('user-1', now, { tokens: 150, costUsdNanos: 4_000 });
        const globalAfter = await prisma.aiUsageLedger.findUniqueOrThrow({
            where: { scope_scopeId_periodKind_period: { scope: 'global', scopeId: GLOBAL_SCOPE_ID, periodKind: PERIOD_KIND_DAY, period } },
        });
        expect(globalAfter).toMatchObject({ reservedRequests: 0, spentRequests: 1, spentTokens: 150, spentCostUsdNanos: 4_000 });
        const userAfter = await prisma.aiUsageLedger.findUniqueOrThrow({
            where: { scope_scopeId_periodKind_period: { scope: 'user', scopeId: 'user-1', periodKind: PERIOD_KIND_DAY, period } },
        });
        expect(userAfter).toMatchObject({ reservedRequests: 0, spentRequests: 1, spentTokens: 150, spentCostUsdNanos: 4_000 });
    });
    it('boundary global: 17 -> 18 aceita, 19 recusa (rejectedScope=global) — GEMINI_GLOBAL_REQUESTS_PER_DAY=18', async () => {
        const now = new Date();
        const period = dayPeriod(now);
        await seedLedgerRow('global', GLOBAL_SCOPE_ID, period, { spentRequests: 17 });
        const eighteenth = await repository.reserveRequest(`user-${crypto.randomUUID()}`, now);
        expect(eighteenth.rejectedScope).toBeUndefined();
        const nineteenth = await repository.reserveRequest(`user-${crypto.randomUUID()}`, now);
        expect(nineteenth.rejectedScope).toBe('global');
        // A reserva recusada não deixou rastro (rollback da transação) — só a 18ª permanece reservada.
        const global = await prisma.aiUsageLedger.findUniqueOrThrow({
            where: { scope_scopeId_periodKind_period: { scope: 'global', scopeId: GLOBAL_SCOPE_ID, periodKind: PERIOD_KIND_DAY, period } },
        });
        expect(global.reservedRequests).toBe(1);
        expect(global.spentRequests).toBe(17);
    });
    it('boundary por usuário: 4 -> 5 aceita, 6 recusa (rejectedScope=user); outro usuário continua operando com a capacidade global restante', async () => {
        const now = new Date();
        const period = dayPeriod(now);
        await seedLedgerRow('user', 'heavy-user', period, { spentRequests: 4 });
        const fifth = await repository.reserveRequest('heavy-user', now);
        expect(fifth.rejectedScope).toBeUndefined();
        const sixth = await repository.reserveRequest('heavy-user', now);
        expect(sixth.rejectedScope).toBe('user');
        // A rejeição por usuário não vazou para o escopo global: outro usuário reserva normalmente.
        const otherUser = await repository.reserveRequest('other-user', now);
        expect(otherUser.rejectedScope).toBeUndefined();
        const heavyUserRow = await prisma.aiUsageLedger.findUniqueOrThrow({
            where: { scope_scopeId_periodKind_period: { scope: 'user', scopeId: 'heavy-user', periodKind: PERIOD_KIND_DAY, period } },
        });
        expect(heavyUserRow.reservedRequests).toBe(1); // só a 5ª ficou reservada; a 6ª foi revertida
        expect(heavyUserRow.spentRequests).toBe(4);
    });
    it('concorrência real: duas reservas simultâneas no limite exato produzem uma aceita e uma recusada, nunca as duas aceitas', async () => {
        const now = new Date();
        const period = dayPeriod(now);
        await seedLedgerRow('user', 'race-user', period, { spentRequests: 4 }); // só resta 1 vaga (teto=5)
        const results = await Promise.allSettled([
            repository.reserveRequest('race-user', now),
            repository.reserveRequest('race-user', now),
        ]);
        const accepted = results.filter((result) => result.status === 'fulfilled' && !result.value.rejectedScope);
        const rejected = results.filter((result) => result.status === 'fulfilled' && result.value.rejectedScope === 'user');
        expect(accepted).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        const raceUserRow = await prisma.aiUsageLedger.findUniqueOrThrow({
            where: { scope_scopeId_periodKind_period: { scope: 'user', scopeId: 'race-user', periodKind: PERIOD_KIND_DAY, period } },
        });
        expect(raceUserRow.reservedRequests).toBe(1); // nunca 2 — a concorrência não ultrapassou o teto
        expect(raceUserRow.spentRequests).toBe(4);
    });
    it('rollover de período diário: teto esgotado ontem não afeta a reserva de hoje', async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        await seedLedgerRow('user', 'daily-user', dayPeriod(yesterday), { spentRequests: 5 }); // ontem: teto (5) esgotado
        const today = await repository.reserveRequest('daily-user', now);
        expect(today.rejectedScope).toBeUndefined(); // novo período, nova linha, novo teto disponível
    });
});
//# sourceMappingURL=ai-usage-ledger.integration.spec.js.map