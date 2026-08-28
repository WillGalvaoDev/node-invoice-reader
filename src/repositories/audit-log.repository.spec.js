import { describe, expect, it } from 'vitest';
import { InMemoryAuditLogRepository } from './in-memory/in-memory-audit-log.repository.js';
import { auditEvents } from '../use-cases/audit-events.js';
// Payload deliberadamente inválido: o ponto destes testes é provar que o guard
// de runtime recusa mesmo quando o sistema de tipos foi contornado por cast.
const forced = (payload) => payload;
const validProductEntry = () => auditEvents.productEntry({
    userId: 'user-1',
    companyId: 'company-1',
    stockId: 'stock-1',
    productId: 'product-1',
    previous: { quantity: 10, unitPrice: 5, totalPrice: 50 },
    next: { quantity: 15, unitPrice: 10, totalPrice: 150 },
});
describe('AuditLogRepository contract', () => {
    it('preserva escopo, descrição e estados mínimos do evento', async () => {
        const repository = new InMemoryAuditLogRepository();
        const created = await repository.create(validProductEntry());
        expect(created).toMatchObject({
            stockId: 'stock-1', description: 'Entrada de estoque processada por invoice.',
            previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
            newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
            createdAt: expect.any(Date),
        });
    });
    it('aceita os quatro eventos legítimos construídos pelos builders', async () => {
        const repository = new InMemoryAuditLogRepository();
        await expect(repository.create(auditEvents.companyCreated({
            userId: 'user-1', companyId: 'company-1', stockId: 'stock-1', defaultStockId: 'stock-1',
        }))).resolves.toBeDefined();
        await expect(repository.create(auditEvents.invoiceUnauthorizedAccess({
            userId: 'user-1', stockId: 'stock-1', companyId: 'company-1',
        }))).resolves.toBeDefined();
        await expect(repository.create(auditEvents.invoiceProcessed({
            userId: 'user-1', companyId: 'company-1', stockId: 'stock-1', accessKey: '3'.repeat(44),
            processedProductCount: 2, pendingSuggestionCount: 1,
        }))).resolves.toBeDefined();
        await expect(repository.create(validProductEntry())).resolves.toBeDefined();
        expect(repository.items).toHaveLength(4);
    });
});
describe('guard estrutural de escrita do AuditLog', () => {
    const repository = () => new InMemoryAuditLogRepository();
    describe('chaves sensíveis — recusadas pela whitelist por evento, não por lista de nomes proibidos', () => {
        it.each([
            'password',
            'passwordHash',
            'currentPassword',
            'newPassword',
            'recoveryCode',
            'token',
            'accessToken',
            'refreshToken',
            'jwt',
            'apiKey',
            'secret',
            'authorization',
            'cookie',
            'email',
        ])('recusa a chave %s em newState', async (key) => {
            const invalid = forced({
                action: 'CREATE', entity: 'COMPANY', description: 'Empresa criada com estoque principal.',
                previousState: null, newState: { companyId: 'company-1', [key]: 'valor-sensivel' },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa chave sensível também em previousState', async () => {
            const invalid = forced({
                action: 'UPDATE', entity: 'PRODUCT', description: 'Entrada de estoque processada por invoice.',
                previousState: { quantity: 10, unitPrice: 5, totalPrice: 50, password: 'hunter2' },
                newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('nenhum valor sensível é persistido quando o guard recusa', async () => {
            const store = repository();
            const invalid = forced({
                action: 'CREATE', entity: 'COMPANY', description: 'x',
                previousState: null, newState: { companyId: 'c', password: 'hunter2' },
            });
            await expect(store.create(invalid)).rejects.toThrow();
            expect(store.items).toHaveLength(0);
        });
    });
    describe('chaves inesperadas', () => {
        it('recusa chave desconhecida, ainda que inofensiva, para aquele evento', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'COMPANY', description: 'x',
                previousState: null, newState: { companyId: 'company-1', defaultStockId: 's', extra: 1 },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa chave legítima de OUTRO evento — a whitelist é por evento, não global', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'COMPANY', description: 'x',
                previousState: null, newState: { companyId: 'company-1', quantity: 10 },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
    });
    describe('formato do state', () => {
        it('recusa objeto aninhado', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'INVOICE', entityId: '3'.repeat(44), description: 'x',
                previousState: null,
                newState: { processedProductCount: 1, pendingSuggestionCount: { nested: true } },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa array como valor', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'INVOICE', entityId: '3'.repeat(44), description: 'x',
                previousState: null,
                newState: { processedProductCount: [1, 2, 3], pendingSuggestionCount: 0 },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa array no lugar do próprio state', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'COMPANY', description: 'x',
                previousState: null, newState: [{ companyId: 'c' }],
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa payload arbitrário inteiro — o caso do requisito central', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'USER', description: 'x',
                newState: {
                    email: 'alguem@exemplo.com',
                    password: 'hunter2',
                    token: 'ey.jwt.token',
                    entireRequestBody: { a: 1 },
                },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
    });
    describe('entity e action', () => {
        it('recusa entity desconhecida', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'USER', description: 'x', previousState: null, newState: null,
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa action fora do enum', async () => {
            const invalid = forced({
                action: 'EXFILTRATE', entity: 'COMPANY', description: 'x', previousState: null, newState: null,
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it.each([
            ['COMPANY', 'UPDATE'],
            ['COMPANY', 'UNAUTHORIZED_ACCESS'],
            ['PRODUCT', 'UNAUTHORIZED_ACCESS'],
            ['INVOICE', 'UPDATE'],
            ['COMPANY', 'DELETE'],
            ['PRODUCT', 'READ'],
        ])('recusa a combinação %s/%s, que não corresponde a nenhum evento real', async (entity, action) => {
            const invalid = forced({ entity, action, description: 'x', previousState: null, newState: null });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
    });
    describe('contrato específico por evento', () => {
        it('recusa previousState não nulo em um evento CREATE', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'PRODUCT', entityId: 'product-1', description: 'x',
                previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
                newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
        it('recusa state em UNAUTHORIZED_ACCESS, que não registra estado algum', async () => {
            const invalid = forced({
                action: 'UNAUTHORIZED_ACCESS', entity: 'INVOICE', description: 'x',
                newState: { stockId: 'stock-1' },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
    });
    describe('details', () => {
        it('recusa details, que saiu da superfície de escrita', async () => {
            const invalid = forced({
                action: 'CREATE', entity: 'COMPANY', description: 'x',
                details: 'texto livre com dado sensível',
                previousState: null, newState: { companyId: 'c', defaultStockId: 's' },
            });
            await expect(repository().create(invalid)).rejects.toThrow(/AuditLog/i);
        });
    });
    describe('brand de compile time', () => {
        it('impede que um objeto literal seja passado a create sem passar por um builder', async () => {
            const store = repository();
            // @ts-expect-error objeto literal não é AuditLogWrite: só os builders produzem o tipo branded.
            await store.create({
                action: 'CREATE', entity: 'COMPANY', description: 'Empresa criada com estoque principal.',
                previousState: null, newState: { companyId: 'company-1', defaultStockId: 'stock-1' },
            }).catch(() => undefined);
            expect(true).toBe(true);
        });
    });
});
//# sourceMappingURL=audit-log.repository.spec.js.map