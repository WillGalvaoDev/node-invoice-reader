import { assertAuditLogWrite } from '../audit-log.repository.js';
export class InMemoryAuditLogRepository {
    items = [];
    async create(log) {
        // O dublê aplica o mesmo guard da implementação real: um teste de use case
        // que montasse um payload inválido falharia aqui, não só em produção.
        assertAuditLogWrite(log);
        const newLog = {
            id: `log-${this.items.length + 1}`,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId ?? null,
            details: null,
            userId: log.userId ?? null,
            companyId: log.companyId ?? null,
            stockId: log.stockId ?? null,
            description: log.description,
            previousState: log.previousState ?? null,
            newState: log.newState ?? null,
            createdAt: new Date(),
        };
        this.items.push(newLog);
        return newLog;
    }
    async findByCompanyId(companyId) {
        return this.items.filter((item) => item.companyId === companyId);
    }
    async findByUserId(userId) {
        return this.items.filter((item) => item.userId === userId);
    }
}
//# sourceMappingURL=in-memory-audit-log.repository.js.map