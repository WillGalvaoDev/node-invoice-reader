import type { IAuditLog, IAuditLogRepository } from '../audit-log.repository.js';

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  public items: IAuditLog[] = [];

  async create(log: IAuditLog): Promise<IAuditLog> {
    const newLog: IAuditLog = {
      id: log.id ?? `log-${this.items.length + 1}`,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId ?? null,
      details: log.details ?? null,
      userId: log.userId ?? null,
      companyId: log.companyId ?? null,
      createdAt: log.createdAt ?? new Date(),
    };

    this.items.push(newLog);
    return newLog;
  }

  async findByCompanyId(companyId: string): Promise<IAuditLog[]> {
    return this.items.filter((item) => item.companyId === companyId);
  }

  async findByUserId(userId: string): Promise<IAuditLog[]> {
    return this.items.filter((item) => item.userId === userId);
  }
}