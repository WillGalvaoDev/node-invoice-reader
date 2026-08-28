import { describe, expect, it } from 'vitest';
import { auditEvents } from './audit-events.js';
// Os cinco eventos abaixo são exatamente os que existem hoje em produção
// (create-company.use-case.ts e read-invoice.use-case.ts). Cada expectativa
// reproduz, campo a campo, o objeto literal que o call site monta hoje —
// é a prova de que mover a construção para os builders não muda semântica.
describe('auditEvents', () => {
    describe('companyCreated', () => {
        it('reproduz o evento COMPANY CREATE existente', () => {
            expect(auditEvents.companyCreated({
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                defaultStockId: 'stock-1',
            })).toEqual({
                action: 'CREATE',
                entity: 'COMPANY',
                entityId: 'company-1',
                description: 'Empresa criada com estoque principal.',
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                previousState: null,
                newState: { companyId: 'company-1', defaultStockId: 'stock-1' },
            });
        });
        it('omite stockId quando o estoque padrão não tem id, preservando o spread condicional atual', () => {
            const event = auditEvents.companyCreated({
                userId: 'user-1',
                companyId: 'company-1',
                defaultStockId: null,
            });
            expect(event).not.toHaveProperty('stockId');
            expect(event.newState).toEqual({ companyId: 'company-1', defaultStockId: null });
        });
    });
    describe('invoiceUnauthorizedAccess', () => {
        it('reproduz o evento INVOICE UNAUTHORIZED_ACCESS existente', () => {
            expect(auditEvents.invoiceUnauthorizedAccess({
                userId: 'user-1',
                stockId: 'stock-1',
                companyId: 'company-1',
            })).toEqual({
                action: 'UNAUTHORIZED_ACCESS',
                entity: 'INVOICE',
                description: 'Tentativa de acesso não autorizado ao estoque.',
                userId: 'user-1',
                stockId: 'stock-1',
                companyId: 'company-1',
            });
        });
        it('omite userId e o par stock/company quando ausentes — o estoque pedido pode não existir', () => {
            const event = auditEvents.invoiceUnauthorizedAccess({});
            expect(event).toEqual({
                action: 'UNAUTHORIZED_ACCESS',
                entity: 'INVOICE',
                description: 'Tentativa de acesso não autorizado ao estoque.',
            });
            expect(event).not.toHaveProperty('userId');
            expect(event).not.toHaveProperty('stockId');
            expect(event).not.toHaveProperty('companyId');
        });
    });
    describe('invoiceProcessed', () => {
        it('reproduz o evento INVOICE CREATE existente, com a accessKey como entityId', () => {
            expect(auditEvents.invoiceProcessed({
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                accessKey: '3'.repeat(44),
                processedProductCount: 3,
                pendingSuggestionCount: 1,
            })).toEqual({
                action: 'CREATE',
                entity: 'INVOICE',
                entityId: '3'.repeat(44),
                description: 'Invoice processada com sucesso.',
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                previousState: null,
                newState: { processedProductCount: 3, pendingSuggestionCount: 1 },
            });
        });
        it('omite userId quando o upload não tem usuário associado', () => {
            expect(auditEvents.invoiceProcessed({
                companyId: 'company-1',
                stockId: 'stock-1',
                accessKey: '3'.repeat(44),
                processedProductCount: 0,
                pendingSuggestionCount: 0,
            })).not.toHaveProperty('userId');
        });
    });
    describe('productEntry', () => {
        const figures = { quantity: 15, unitPrice: 10, totalPrice: 150 };
        it('deriva CREATE quando não há produto anterior, reproduzindo o evento PRODUCT CREATE existente', () => {
            expect(auditEvents.productEntry({
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                productId: 'product-1',
                previous: null,
                next: figures,
            })).toEqual({
                action: 'CREATE',
                entity: 'PRODUCT',
                entityId: 'product-1',
                description: 'Entrada de estoque processada por invoice.',
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                previousState: null,
                newState: figures,
            });
        });
        it('deriva UPDATE quando há produto anterior, reproduzindo o evento PRODUCT UPDATE existente', () => {
            const previous = { quantity: 10, unitPrice: 5, totalPrice: 50 };
            expect(auditEvents.productEntry({
                userId: 'user-1',
                companyId: 'company-1',
                stockId: 'stock-1',
                productId: 'product-1',
                previous,
                next: figures,
            })).toMatchObject({
                action: 'UPDATE',
                entity: 'PRODUCT',
                previousState: previous,
                newState: figures,
            });
        });
        it('extrai apenas quantity/unitPrice/totalPrice, descartando o restante do produto', () => {
            const productLike = {
                quantity: 15, unitPrice: 10, totalPrice: 150,
                code: 'ABC-123', description: 'Produto secreto do catálogo', ean: '789', stockId: 'stock-1',
            };
            const event = auditEvents.productEntry({
                companyId: 'company-1',
                stockId: 'stock-1',
                productId: 'product-1',
                previous: null,
                next: productLike,
            });
            expect(event.newState).toEqual({ quantity: 15, unitPrice: 10, totalPrice: 150 });
            expect(event.newState).not.toHaveProperty('code');
            expect(event.newState).not.toHaveProperty('description');
            expect(event.newState).not.toHaveProperty('ean');
        });
    });
    it('nenhum builder produz o campo details — ele saiu da superfície de escrita', () => {
        const events = [
            auditEvents.companyCreated({ userId: 'u', companyId: 'c', defaultStockId: 's' }),
            auditEvents.invoiceUnauthorizedAccess({ userId: 'u' }),
            auditEvents.invoiceProcessed({
                companyId: 'c', stockId: 's', accessKey: '3'.repeat(44),
                processedProductCount: 1, pendingSuggestionCount: 0,
            }),
            auditEvents.productEntry({
                companyId: 'c', stockId: 's', productId: 'p',
                previous: null, next: { quantity: 1, unitPrice: 1, totalPrice: 1 },
            }),
        ];
        for (const event of events) {
            expect(event).not.toHaveProperty('details');
        }
    });
});
//# sourceMappingURL=audit-events.spec.js.map