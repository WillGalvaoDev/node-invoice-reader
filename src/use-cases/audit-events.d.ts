import type { AuditLogWrite } from '../repositories/audit-log.repository.js';
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
export declare const auditEvents: {
    companyCreated({ userId, companyId, stockId, defaultStockId }: {
        userId: string;
        companyId: string;
        stockId?: string | undefined;
        defaultStockId: string | null;
    }): AuditLogWrite;
    invoiceUnauthorizedAccess({ userId, stockId, companyId }: {
        userId?: string | undefined;
        stockId?: string | undefined;
        companyId?: string | undefined;
    }): AuditLogWrite;
    invoiceProcessed({ userId, companyId, stockId, accessKey, processedProductCount, pendingSuggestionCount }: {
        userId?: string | undefined;
        companyId: string;
        stockId: string;
        accessKey: string;
        processedProductCount: number;
        pendingSuggestionCount: number;
    }): AuditLogWrite;
    /** `previous === null` significa produto novo; caso contrário, entrada sobre saldo existente. */
    productEntry({ userId, companyId, stockId, productId, previous, next }: {
        userId?: string | undefined;
        companyId: string;
        stockId: string;
        productId: string;
        previous: ProductAuditFigures | null;
        next: ProductAuditFigures;
    }): AuditLogWrite;
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
        decision: "confirmed" | "rejected";
        previous: ProductAuditFigures | null;
        next: ProductAuditFigures;
    }): AuditLogWrite;
    /** Nenhum material de senha entra aqui — só o inteiro de revogação, antes e depois. */
    userPasswordChanged({ userId, previousAuthVersion, newAuthVersion }: {
        userId: string;
        previousAuthVersion: number;
        newAuthVersion: number;
    }): AuditLogWrite;
};
//# sourceMappingURL=audit-events.d.ts.map