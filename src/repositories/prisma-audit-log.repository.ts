import { PrismaClient, type AuditAction } from '@prisma/client';
import type { IAuditLogRepository, IAuditLog } from './audit-log.repository.js';
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export class PrismaAuditLogRepository implements IAuditLogRepository {
  async create(log: IAuditLog): Promise<IAuditLog> {
    const createdLog = await prisma.auditLog.create({
      data: {
        action: log.action as AuditAction,
        entity: log.entity,
        ...(log.entityId && { entityId: log.entityId }),
        ...(log.details && { details: log.details }),
        ...(log.userId && { userId: log.userId }),
        ...(log.companyId && { companyId: log.companyId }),
      },
    });

    return createdLog as IAuditLog;
  }

  async findByCompanyId(companyId: string): Promise<IAuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return logs as IAuditLog[];
  }

  async findByUserId(userId: string): Promise<IAuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return logs as IAuditLog[];
  }
}