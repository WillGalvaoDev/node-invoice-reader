import { assertAuditLogWrite } from './audit-log.repository.js';
import { prisma } from '../infra/prisma.js';
import { AuditLogMapper } from '../mappers/audit-log.mapper.js';
export class PrismaAuditLogRepository {
    async create(log) {
        // Última fronteira antes do banco: nada é escrito se o evento não for válido.
        assertAuditLogWrite(log);
        const data = {
            action: log.action,
            entity: log.entity,
            ...(log.entityId && { entityId: log.entityId }),
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
        return AuditLogMapper.toDomain(createdLog);
    }
    async findByCompanyId(companyId) {
        const logs = await prisma.auditLog.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        return logs.map(AuditLogMapper.toDomain);
    }
    async findByUserId(userId) {
        const logs = await prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return logs.map(AuditLogMapper.toDomain);
    }
}
//# sourceMappingURL=prisma-audit-log.repository.js.map