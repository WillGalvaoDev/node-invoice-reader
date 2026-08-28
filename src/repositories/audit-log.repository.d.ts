export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'UNAUTHORIZED_ACCESS';
export type AuditEntity = 'COMPANY' | 'INVOICE' | 'PRODUCT' | 'USER';
export type AuditState = Record<string, string | number | boolean | null>;
/**
 * Representação de leitura: o que o banco devolve, incluindo colunas legadas
 * (`details`) que já não fazem parte da superfície de escrita.
 */
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
/** Campos graváveis. `details` não está aqui: saiu da superfície de escrita. */
export interface AuditLogWriteFields {
    action: AuditAction;
    entity: AuditEntity;
    entityId?: string;
    userId?: string;
    companyId?: string;
    stockId?: string;
    description: string;
    previousState?: AuditState | null;
    newState?: AuditState | null;
}
declare const auditLogWriteBrand: unique symbol;
/**
 * Contrato fechado de escrita. Só os builders de `use-cases/audit-events.ts`
 * produzem este tipo — um objeto literal não satisfaz a marca, então o
 * compilador recusa `create({ ... })` em qualquer call site.
 */
export type AuditLogWrite = AuditLogWriteFields & {
    readonly [auditLogWriteBrand]: true;
};
export interface IAuditLogRepository {
    create(log: AuditLogWrite): Promise<IAuditLog>;
    findByCompanyId(companyId: string): Promise<IAuditLog[]>;
    findByUserId(userId: string): Promise<IAuditLog[]>;
}
/**
 * Rede de segurança de runtime. A barreira primária é o tipo branded; este
 * guard existe porque a marca é apagada na compilação e não alcança um `as`
 * deliberado, código JavaScript, nem um call site futuro fora do padrão.
 */
export declare function assertAuditLogWrite(log: AuditLogWrite): void;
export {};
//# sourceMappingURL=audit-log.repository.d.ts.map