import { AppError } from '../errors/app-error.js';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'UNAUTHORIZED_ACCESS'; // 👈 Adicionado evento explícito de segurança

export type AuditEntity = 'COMPANY' | 'INVOICE' | 'PRODUCT';

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
export type AuditLogWrite = AuditLogWriteFields & { readonly [auditLogWriteBrand]: true };

export interface IAuditLogRepository {
  create(log: AuditLogWrite): Promise<IAuditLog>;
  findByCompanyId(companyId: string): Promise<IAuditLog[]>;
  findByUserId(userId: string): Promise<IAuditLog[]>;
}

/**
 * Whitelist positiva: cada evento real declara exatamente quais chaves pode
 * levar em cada estado. Lista vazia significa "este evento não registra estado".
 * Um evento novo só passa a ser aceito quando entra aqui — não há caminho
 * genérico, e por isso nenhuma lista de nomes proibidos é necessária.
 */
const AUDIT_EVENT_STATE_KEYS: Record<string, { previous: readonly string[]; next: readonly string[] }> = {
  'COMPANY:CREATE': { previous: [], next: ['companyId', 'defaultStockId'] },
  'INVOICE:CREATE': { previous: [], next: ['processedProductCount', 'pendingSuggestionCount'] },
  'INVOICE:UNAUTHORIZED_ACCESS': { previous: [], next: [] },
  'PRODUCT:CREATE': { previous: [], next: ['quantity', 'unitPrice', 'totalPrice'] },
  'PRODUCT:UPDATE': {
    previous: ['quantity', 'unitPrice', 'totalPrice'],
    next: ['quantity', 'unitPrice', 'totalPrice'],
  },
};

const WRITABLE_FIELDS = new Set([
  'action', 'entity', 'entityId', 'userId', 'companyId', 'stockId',
  'description', 'previousState', 'newState',
]);

const OPTIONAL_ID_FIELDS = ['entityId', 'userId', 'companyId', 'stockId'] as const;

function reject(reason: string): never {
  throw new AppError(`Evento de AuditLog recusado: ${reason}`, 500);
}

function assertState(value: unknown, allowedKeys: readonly string[], field: string): void {
  if (value === undefined || value === null) return;

  if (typeof value !== 'object' || Array.isArray(value)) {
    reject(`${field} deve ser um objeto plano ou nulo.`);
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!allowedKeys.includes(key)) {
      reject(`chave "${key}" não é permitida em ${field} para este evento.`);
    }
    const type = typeof entry;
    if (entry !== null && type !== 'string' && type !== 'number' && type !== 'boolean') {
      reject(`valor de "${key}" em ${field} deve ser string, número, booleano ou nulo.`);
    }
  }
}

/**
 * Rede de segurança de runtime. A barreira primária é o tipo branded; este
 * guard existe porque a marca é apagada na compilação e não alcança um `as`
 * deliberado, código JavaScript, nem um call site futuro fora do padrão.
 */
export function assertAuditLogWrite(log: AuditLogWrite): void {
  if (typeof log !== 'object' || log === null || Array.isArray(log)) {
    reject('o evento deve ser um objeto.');
  }

  const candidate = log as unknown as Record<string, unknown>;

  for (const field of Object.keys(candidate)) {
    if (!WRITABLE_FIELDS.has(field)) {
      reject(`campo "${field}" não faz parte da superfície de escrita.`);
    }
  }

  const shape = AUDIT_EVENT_STATE_KEYS[`${String(candidate.entity)}:${String(candidate.action)}`];
  if (!shape) {
    reject(`combinação entity/action desconhecida.`);
  }

  if (typeof candidate.description !== 'string' || candidate.description.trim() === '') {
    reject('description é obrigatória.');
  }

  for (const field of OPTIONAL_ID_FIELDS) {
    const value = candidate[field];
    if (value !== undefined && typeof value !== 'string') {
      reject(`${field} deve ser uma string quando presente.`);
    }
  }

  assertState(candidate.previousState, shape.previous, 'previousState');
  assertState(candidate.newState, shape.next, 'newState');
}
