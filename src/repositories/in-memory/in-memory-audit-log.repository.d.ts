import type { IAuditLog, IAuditLogRepository, AuditLogWrite } from '../audit-log.repository.js';
export declare class InMemoryAuditLogRepository implements IAuditLogRepository {
    items: IAuditLog[];
    create(log: AuditLogWrite): Promise<IAuditLog>;
    findByCompanyId(companyId: string): Promise<IAuditLog[]>;
    findByUserId(userId: string): Promise<IAuditLog[]>;
}
//# sourceMappingURL=in-memory-audit-log.repository.d.ts.map