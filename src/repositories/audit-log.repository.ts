export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'READ' 
  | 'UNAUTHORIZED_ACCESS'; // 👈 Adicionado evento explícito de segurança

export type AuditState = Record<string, string | number | boolean | null>;

export interface IAuditLog {
  id?: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  userId?: string | null;
  companyId?: string | null;
  stockId?: string | null;
  description?: string | null;
  previousState?: AuditState | null;
  newState?: AuditState | null;
  createdAt?: Date;
}

export interface IAuditLogRepository {
  create(log: IAuditLog): Promise<IAuditLog>;
  findByCompanyId(companyId: string): Promise<IAuditLog[]>;
  findByUserId(userId: string): Promise<IAuditLog[]>;
}
