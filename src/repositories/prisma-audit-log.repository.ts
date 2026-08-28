import type { AuditAction, Prisma } from '@prisma/client';
import type { IAuditLogRepository, IAuditLog, AuditLogWrite } from './audit-log.repository.js';
import { assertAuditLogWrite } from './audit-log.repository.js';
import { prisma } from '../infra/prisma.js';
import { AuditLogMapper } from '../mappers/audit-log.mapper.js';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  async create(log: AuditLogWrite): Promise<IAuditLog> {
    // Última fronteira antes do banco: nada é escrito se o evento não for válido.
    assertAuditLogWrite(log);

    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: log.action as AuditAction,
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

  async findByCompanyId(companyId: string): Promise<IAuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map(AuditLogMapper.toDomain);
  }

  async findByUserId(userId: string): Promise<IAuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map(AuditLogMapper.toDomain);
  }
}
