import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditEvents } from '../use-cases/audit-events.js';
const prismaMock = vi.hoisted(() => ({ auditLog: { create: vi.fn(), findMany: vi.fn() } }));
vi.mock('../infra/prisma.js', () => ({ prisma: prismaMock }));
const forced = (payload) => payload;
describe('PrismaAuditLogRepository — última fronteira antes do banco', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.auditLog.create.mockImplementation(async ({ data }) => ({
            id: 'log-1', entityId: null, details: null, userId: null, companyId: null, stockId: null,
            description: null, previousState: null, newState: null, createdAt: new Date(), ...data,
        }));
    });
    it('persiste um evento legítimo construído por builder', async () => {
        const { PrismaAuditLogRepository } = await import('./prisma-audit-log.repository.js');
        await new PrismaAuditLogRepository().create(auditEvents.companyCreated({
            userId: 'user-1', companyId: 'company-1', stockId: 'stock-1', defaultStockId: 'stock-1',
        }));
        expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
        expect(prismaMock.auditLog.create.mock.calls[0]?.[0].data).toMatchObject({
            action: 'CREATE', entity: 'COMPANY', entityId: 'company-1',
            newState: { companyId: 'company-1', defaultStockId: 'stock-1' },
        });
    });
    it('recusa payload inválido SEM tocar o banco — o guard roda antes do INSERT', async () => {
        const { PrismaAuditLogRepository } = await import('./prisma-audit-log.repository.js');
        const invalid = forced({
            action: 'CREATE', entity: 'COMPANY', description: 'x',
            previousState: null, newState: { companyId: 'company-1', password: 'hunter2' },
        });
        await expect(new PrismaAuditLogRepository().create(invalid)).rejects.toThrow(/AuditLog/i);
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });
    it('nunca envia details ao banco — o campo saiu do contrato de escrita', async () => {
        const { PrismaAuditLogRepository } = await import('./prisma-audit-log.repository.js');
        await new PrismaAuditLogRepository().create(auditEvents.invoiceProcessed({
            userId: 'user-1', companyId: 'company-1', stockId: 'stock-1', accessKey: '3'.repeat(44),
            processedProductCount: 2, pendingSuggestionCount: 0,
        }));
        expect(prismaMock.auditLog.create.mock.calls[0]?.[0].data).not.toHaveProperty('details');
    });
});
//# sourceMappingURL=prisma-audit-log.repository.spec.js.map