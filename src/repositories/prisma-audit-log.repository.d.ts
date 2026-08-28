import type { IAuditLogRepository, IAuditLog, AuditLogWrite } from './audit-log.repository.js';
export declare class PrismaAuditLogRepository implements IAuditLogRepository {
    create(log: AuditLogWrite): Promise<IAuditLog>;
    findByCompanyId(companyId: string): Promise<IAuditLog[]>;
    findByUserId(userId: string): Promise<IAuditLog[]>;
}
//# sourceMappingURL=prisma-audit-log.repository.d.ts.map