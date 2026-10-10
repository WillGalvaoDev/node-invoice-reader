import { prisma } from '../infra/prisma.js';
import { env } from '../config/env.js';
const PERIOD_KIND_DAY = 'day';
const GLOBAL_SCOPE_ID = 'global';
/** Chave de período diário em UTC (`YYYY-MM-DD`) — vira automaticamente na virada do dia. */
function dayPeriod(now) {
    return now.toISOString().slice(0, 10);
}
/** Sinaliza qual escopo excedeu o teto para que a transação (Prisma) faça o rollback de ambos. */
class LedgerCapExceeded extends Error {
    scope;
    constructor(scope) {
        super(`Teto interno de requisições excedido no escopo "${scope}".`);
        this.scope = scope;
    }
}
export class PrismaAiUsageLedgerRepository {
    async reserveRequest(userId, now) {
        const period = dayPeriod(now);
        try {
            await prisma.$transaction(async (transaction) => {
                const global = await transaction.aiUsageLedger.upsert({
                    where: { scope_scopeId_periodKind_period: { scope: 'global', scopeId: GLOBAL_SCOPE_ID, periodKind: PERIOD_KIND_DAY, period } },
                    create: { scope: 'global', scopeId: GLOBAL_SCOPE_ID, periodKind: PERIOD_KIND_DAY, period, reservedRequests: 1 },
                    update: { reservedRequests: { increment: 1 } },
                });
                if (env.GEMINI_QUOTA_ENFORCEMENT_ENABLED && global.reservedRequests + global.spentRequests > env.GEMINI_GLOBAL_REQUESTS_PER_DAY) {
                    throw new LedgerCapExceeded('global');
                }
                const user = await transaction.aiUsageLedger.upsert({
                    where: { scope_scopeId_periodKind_period: { scope: 'user', scopeId: userId, periodKind: PERIOD_KIND_DAY, period } },
                    create: { scope: 'user', scopeId: userId, periodKind: PERIOD_KIND_DAY, period, reservedRequests: 1 },
                    update: { reservedRequests: { increment: 1 } },
                });
                if (env.GEMINI_QUOTA_ENFORCEMENT_ENABLED && user.reservedRequests + user.spentRequests > env.GEMINI_USER_REQUESTS_PER_DAY) {
                    throw new LedgerCapExceeded('user');
                }
            });
            return {};
        }
        catch (error) {
            if (error instanceof LedgerCapExceeded)
                return { rejectedScope: error.scope };
            throw error;
        }
    }
    async reconcileRequest(userId, now, usage) {
        const period = dayPeriod(now);
        const tokens = usage.tokens ?? 0;
        const costUsdNanos = usage.costUsdNanos ?? 0;
        await prisma.$transaction([
            prisma.aiUsageLedger.update({
                where: { scope_scopeId_periodKind_period: { scope: 'global', scopeId: GLOBAL_SCOPE_ID, periodKind: PERIOD_KIND_DAY, period } },
                data: {
                    reservedRequests: { decrement: 1 },
                    spentRequests: { increment: 1 },
                    spentTokens: { increment: tokens },
                    spentCostUsdNanos: { increment: costUsdNanos },
                },
            }),
            prisma.aiUsageLedger.update({
                where: { scope_scopeId_periodKind_period: { scope: 'user', scopeId: userId, periodKind: PERIOD_KIND_DAY, period } },
                data: {
                    reservedRequests: { decrement: 1 },
                    spentRequests: { increment: 1 },
                    spentTokens: { increment: tokens },
                    spentCostUsdNanos: { increment: costUsdNanos },
                },
            }),
        ]);
    }
}
//# sourceMappingURL=prisma-ai-usage-ledger.repository.js.map