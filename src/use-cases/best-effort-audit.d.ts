import type { Logger } from '../infra/logger.js';
import type { IAuditLog, IAuditLogRepository } from '../repositories/audit-log.repository.js';
interface BestEffortAuditOptions {
    repository: IAuditLogRepository;
    logger: Logger;
    log: IAuditLog;
    requestId?: string | undefined;
}
export declare function persistAuditBestEffort({ repository, logger, log, requestId }: BestEffortAuditOptions): Promise<void>;
export {};
//# sourceMappingURL=best-effort-audit.d.ts.map