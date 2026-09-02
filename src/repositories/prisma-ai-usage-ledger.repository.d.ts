import type { AiUsageLedgerReconciliation, AiUsageLedgerReservation, IAiUsageLedgerRepository } from './ai-usage-ledger.repository.js';
export declare class PrismaAiUsageLedgerRepository implements IAiUsageLedgerRepository {
    reserveRequest(userId: string, now: Date): Promise<AiUsageLedgerReservation>;
    reconcileRequest(userId: string, now: Date, usage: AiUsageLedgerReconciliation): Promise<void>;
}
//# sourceMappingURL=prisma-ai-usage-ledger.repository.d.ts.map