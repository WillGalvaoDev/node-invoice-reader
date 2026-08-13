export class InMemoryAuditLogRepository {
    items = [];
    async create(log) {
        const newLog = {
            id: log.id ?? `log-${this.items.length + 1}`,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId ?? null,
            details: log.details ?? null,
            userId: log.userId ?? null,
            companyId: log.companyId ?? null,
            stockId: log.stockId ?? null,
            description: log.description ?? null,
            previousState: log.previousState ?? null,
            newState: log.newState ?? null,
            createdAt: log.createdAt ?? new Date(),
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