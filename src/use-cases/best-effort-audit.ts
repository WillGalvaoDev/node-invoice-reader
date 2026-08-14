import type { Logger } from '../infra/logger.js';
import type { IAuditLog, IAuditLogRepository } from '../repositories/audit-log.repository.js';

interface BestEffortAuditOptions {
  repository: IAuditLogRepository;
  logger: Logger;
  log: IAuditLog;
  requestId?: string | undefined;
}

export async function persistAuditBestEffort({ repository, logger, log, requestId }: BestEffortAuditOptions): Promise<void> {
  try {
    await repository.create(log);
  } catch (error) {
    logger.error('Failed to persist audit log', {
      ...(requestId && { requestId }),
      action: log.action,
      entity: log.entity,
      error: { name: error instanceof Error ? error.name : 'UnknownError' },
    });
  }
}
