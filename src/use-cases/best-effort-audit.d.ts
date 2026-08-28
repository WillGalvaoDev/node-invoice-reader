import type { Logger } from '../infra/logger.js';
import type { AuditLogWrite, IAuditLogRepository } from '../repositories/audit-log.repository.js';
interface BestEffortAuditOptions {
    repository: IAuditLogRepository;
    logger: Logger;
    log: AuditLogWrite;
    requestId?: string | undefined;
}
export declare function persistAuditBestEffort({ repository, logger, log, requestId }: BestEffortAuditOptions): Promise<void>;
export {};
//# sourceMappingURL=best-effort-audit.d.ts.map