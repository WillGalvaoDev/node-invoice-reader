export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';

export interface IAuditLog {
  id?: string;
  action: AuditAction; // Em vez de string genérica
  entity: string;
  entityId?: string | null;
  details?: string | null;
  userId?: string | null;
  companyId?: string | null;
  createdAt?: Date;
}

export interface IAuditLogRepository {
  create(log: IAuditLog): Promise<IAuditLog>;
  findByCompanyId(companyId: string): Promise<IAuditLog[]>;
  findByUserId(userId: string): Promise<IAuditLog[]>;
}