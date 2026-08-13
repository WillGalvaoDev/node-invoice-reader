import { prisma } from '../infra/prisma.js';
export class PrismaAuditLogRepository {
    async create(log) {
        const data = {
            action: log.action,
            entity: log.entity,
            ...(log.entityId && { entityId: log.entityId }),
            ...(log.details && { details: log.details }),
            ...(log.userId && { userId: log.userId }),
            ...(log.companyId && { companyId: log.companyId }),
            ...(log.stockId && { stockId: log.stockId }),
            ...(log.description && { description: log.description }),
            ...(log.previousState && { previousState: log.previousState }),
            ...(log.newState && { newState: log.newState }),
        };
        const createdLog = await prisma.auditLog.create({
            data,
        });
        return createdLog;
    }
    async findByCompanyId(companyId) {
        const logs = await prisma.auditLog.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        return logs;
    }
    async findByUserId(userId) {
        const logs = await prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return logs;
    }
}
//# sourceMappingURL=prisma-audit-log.repository.js.map