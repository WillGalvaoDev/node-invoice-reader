export class AuditLogMapper {
    static toDomain(raw) {
        return {
            id: raw.id,
            action: raw.action,
            entity: raw.entity,
            entityId: raw.entityId,
            details: raw.details,
            userId: raw.userId,
            companyId: raw.companyId,
            stockId: raw.stockId,
            description: raw.description,
            // Colunas Json do Prisma são JsonValue; o formato AuditState é garantido por quem grava, não pelo schema.
            previousState: raw.previousState,
            newState: raw.newState,
            createdAt: raw.createdAt,
        };
    }
}
//# sourceMappingURL=audit-log.mapper.js.map