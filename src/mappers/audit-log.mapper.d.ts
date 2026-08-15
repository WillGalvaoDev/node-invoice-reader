import type { AuditLog as PrismaAuditLog } from '@prisma/client';
import type { IAuditLog } from '../repositories/audit-log.repository.js';
export declare class AuditLogMapper {
    static toDomain(raw: PrismaAuditLog): IAuditLog;
}
//# sourceMappingURL=audit-log.mapper.d.ts.map