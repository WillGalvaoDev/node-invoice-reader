import type { AuditLog as PrismaAuditLog } from '@prisma/client';
import type { AuditState, IAuditLog } from '../repositories/audit-log.repository.js';

export class AuditLogMapper {
  static toDomain(raw: PrismaAuditLog): IAuditLog {
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
      previousState: raw.previousState as AuditState | null,
      newState: raw.newState as AuditState | null,
      createdAt: raw.createdAt,
    };
  }
}
