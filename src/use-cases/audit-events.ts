import type { AuditLogWrite, AuditLogWriteFields, AuditState } from '../repositories/audit-log.repository.js';

/**
 * Construtores dos eventos de auditoria que existem de fato no sistema.
 *
 * O call site fornece apenas os dados do evento; `entity`, `action`,
 * `description` e a forma de `previousState`/`newState` pertencem ao builder.
 * Não existe construtor genérico: registrar um evento novo exige uma função
 * nova aqui e a entrada correspondente na whitelist do contrato, o que torna
 * a ampliação da superfície visível em code review.
 */

/** Os três números que descrevem uma posição de estoque — e nada além deles. */
export interface ProductAuditFigures {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** Único ponto do sistema que produz a marca de escrita — deliberadamente um só. */
const sealed = (event: AuditLogWriteFields): AuditLogWrite => event as AuditLogWrite;

/** Extrai só os três números: um `IProduct` inteiro entra, nada além disso sai. */
function figures({ quantity, unitPrice, totalPrice }: ProductAuditFigures): AuditState {
  return { quantity, unitPrice, totalPrice };
}

export const auditEvents = {
  companyCreated({ userId, companyId, stockId, defaultStockId }: {
    userId: string;
    companyId: string;
    stockId?: string | undefined;
    defaultStockId: string | null;
  }): AuditLogWrite {
    return sealed({
      action: 'CREATE',
      entity: 'COMPANY',
      entityId: companyId,
      description: 'Empresa criada com estoque principal.',
      userId,
      companyId,
      ...(stockId && { stockId }),
      previousState: null,
      newState: { companyId, defaultStockId },
    });
  },

  invoiceUnauthorizedAccess({ userId, stockId, companyId }: {
    userId?: string | undefined;
    stockId?: string | undefined;
    companyId?: string | undefined;
  }): AuditLogWrite {
    return sealed({
      action: 'UNAUTHORIZED_ACCESS',
      entity: 'INVOICE',
      description: 'Tentativa de acesso não autorizado ao estoque.',
      ...(userId && { userId }),
      ...(stockId && { stockId }),
      ...(companyId && { companyId }),
    });
  },

  invoiceProcessed({ userId, companyId, stockId, accessKey, processedProductCount, pendingSuggestionCount }: {
    userId?: string | undefined;
    companyId: string;
    stockId: string;
    accessKey: string;
    processedProductCount: number;
    pendingSuggestionCount: number;
  }): AuditLogWrite {
    return sealed({
      action: 'CREATE',
      entity: 'INVOICE',
      entityId: accessKey,
      description: 'Invoice processada com sucesso.',
      ...(userId && { userId }),
      companyId,
      stockId,
      previousState: null,
      newState: { processedProductCount, pendingSuggestionCount },
    });
  },

  /** `previous === null` significa produto novo; caso contrário, entrada sobre saldo existente. */
  productEntry({ userId, companyId, stockId, productId, previous, next }: {
    userId?: string | undefined;
    companyId: string;
    stockId: string;
    productId: string;
    previous: ProductAuditFigures | null;
    next: ProductAuditFigures;
  }): AuditLogWrite {
    return sealed({
      action: previous ? 'UPDATE' : 'CREATE',
      entity: 'PRODUCT',
      entityId: productId,
      description: 'Entrada de estoque processada por invoice.',
      ...(userId && { userId }),
      companyId,
      stockId,
      previousState: previous ? figures(previous) : null,
      newState: figures(next),
    });
  },

  /**
   * Decisão humana sobre sugestão de similaridade (P3-00A): confirmar aplica a entrada no
   * produto sugerido; rejeitar aplica a um produto diferente. Mesma forma de `productEntry`
   * (entity/action/estados), descrição própria — não é "processado por invoice".
   */
  productSuggestionDecided({ userId, companyId, stockId, productId, decision, previous, next }: {
    userId?: string | undefined;
    companyId: string;
    stockId: string;
    productId: string;
    decision: 'confirmed' | 'rejected';
    previous: ProductAuditFigures | null;
    next: ProductAuditFigures;
  }): AuditLogWrite {
    return sealed({
      action: previous ? 'UPDATE' : 'CREATE',
      entity: 'PRODUCT',
      entityId: productId,
      description: decision === 'confirmed'
        ? 'Sugestão de produto confirmada; entrada aplicada ao produto sugerido.'
        : 'Sugestão de produto rejeitada; entrada aplicada a um produto diferente do sugerido.',
      ...(userId && { userId }),
      companyId,
      stockId,
      previousState: previous ? figures(previous) : null,
      newState: figures(next),
    });
  },

  /** Nenhum material de senha entra aqui — só o inteiro de revogação, antes e depois. */
  userPasswordChanged({ userId, previousAuthVersion, newAuthVersion }: {
    userId: string;
    previousAuthVersion: number;
    newAuthVersion: number;
  }): AuditLogWrite {
    return sealed({
      action: 'UPDATE',
      entity: 'USER',
      entityId: userId,
      description: 'Senha do usuário alterada.',
      userId,
      previousState: { authVersion: previousAuthVersion },
      newState: { authVersion: newAuthVersion },
    });
  },
};
