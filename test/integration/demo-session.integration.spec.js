import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { PrismaDemoSessionRepository } from '../../src/repositories/prisma-demo-session.repository.js';
import { deriveDemoAccessKey } from '../../src/demo/demo-scenario.js';
import { generateSyntheticCnpj } from '../../src/demo/synthetic-cnpj.js';
import { AppError } from '../../src/errors/app-error.js';
const repository = new PrismaDemoSessionRepository();
function freshIdentity() {
    const sessionId = crypto.randomUUID();
    return {
        sessionId,
        cnpj: generateSyntheticCnpj(),
        accessKeys: { initial: deriveDemoAccessKey(sessionId, 'initial'), followup: deriveDemoAccessKey(sessionId, 'followup') },
    };
}
beforeEach(async () => {
    await prisma.demoDocumentKey.deleteMany();
    await prisma.demoSession.deleteMany();
    await prisma.aiCallEvent.deleteMany();
    await prisma.aiUsageLedger.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.productSimilaritySuggestion.deleteMany();
    await prisma.processedInvoice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.stockPermission.deleteMany();
    await prisma.companyCollaborator.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
});
afterAll(disconnectPrisma);
const user = (email) => prisma.user.create({ data: { email, name: email, password: 'synthetic' } });
describe('DemoSession (DP-02)', () => {
    it('S01: usuários distintos recebem sessões, empresas, CNPJs e chaves distintos com estoque vazio', async () => {
        const [a, b] = [await user('a@example.test'), await user('b@example.test')];
        const first = await repository.createForOwner(a.id, freshIdentity);
        const second = await repository.createForOwner(b.id, freshIdentity);
        expect(first.created).toBe(true);
        expect(second.created).toBe(true);
        expect(new Set([first.session.id, second.session.id]).size).toBe(2);
        expect(new Set([first.session.companyId, second.session.companyId]).size).toBe(2);
        const companies = await prisma.company.findMany();
        expect(new Set(companies.map((company) => company.cnpj)).size).toBe(2);
        expect(await prisma.demoDocumentKey.count()).toBe(4);
        expect(await prisma.product.count()).toBe(0);
        expect(await prisma.processedInvoice.count()).toBe(0);
        expect(await prisma.aiCallEvent.count()).toBe(0);
        expect(first.session).toMatchObject({ ownerId: a.id, state: 'ACTIVE', successorId: null });
        const company = companies.find((item) => item.id === first.session.companyId);
        expect(company.ownerId).toBe(a.id);
        expect((await prisma.stock.findUniqueOrThrow({ where: { id: first.session.stockId } })).companyId).toBe(company.id);
    });
    it('reutiliza a sessão ativa sem criar novos recursos', async () => {
        const owner = await user('a@example.test');
        const first = await repository.createForOwner(owner.id, freshIdentity);
        const again = await repository.createForOwner(owner.id, freshIdentity);
        expect(again.created).toBe(false);
        expect(again.session.id).toBe(first.session.id);
        expect(await prisma.company.count()).toBe(1);
        expect(await prisma.demoSession.count()).toBe(1);
    });
    it('S03: duas preparações simultâneas resultam em uma sessão ativa e nenhum recurso órfão', async () => {
        const owner = await user('a@example.test');
        const results = await Promise.all([
            repository.createForOwner(owner.id, freshIdentity),
            repository.createForOwner(owner.id, freshIdentity),
            repository.createForOwner(owner.id, freshIdentity),
        ]);
        expect(new Set(results.map((result) => result.session.id)).size).toBe(1);
        expect(results.filter((result) => result.created)).toHaveLength(1);
        expect(await prisma.demoSession.count({ where: { state: 'ACTIVE' } })).toBe(1);
        expect(await prisma.company.count()).toBe(1);
        expect(await prisma.stock.count()).toBe(1);
        expect(await prisma.demoDocumentKey.count()).toBe(2);
    });
    it('S02: sessão de outro usuário é indistinguível de inexistente e não é alterada', async () => {
        const [a, b] = [await user('a@example.test'), await user('b@example.test')];
        const { session } = await repository.createForOwner(a.id, freshIdentity);
        expect(await repository.findByIdForOwner(session.id, b.id)).toBeNull();
        expect(await repository.findByIdForOwner(crypto.randomUUID(), b.id)).toBeNull();
        expect(await repository.restart(session.id, b.id, freshIdentity)).toBeNull();
        expect((await prisma.demoSession.findUniqueOrThrow({ where: { id: session.id } })).state).toBe('ACTIVE');
        expect(await prisma.demoSession.count()).toBe(1);
    });
    it('reinício arquiva a sessão, cria sucessora vazia com novo CNPJ e novas chaves', async () => {
        const owner = await user('a@example.test');
        const { session: old } = await repository.createForOwner(owner.id, freshIdentity);
        const successor = await repository.restart(old.id, owner.id, freshIdentity);
        expect(successor).toMatchObject({ state: 'ACTIVE', ownerId: owner.id });
        expect(successor.id).not.toBe(old.id);
        expect(successor.companyId).not.toBe(old.companyId);
        const archived = await prisma.demoSession.findUniqueOrThrow({ where: { id: old.id } });
        expect(archived).toMatchObject({ state: 'ARCHIVED', successorId: successor.id });
        expect(archived.archivedAt).not.toBeNull();
        expect((await repository.findActiveByOwner(owner.id)).id).toBe(successor.id);
        // Registros compartilhados e a empresa anterior permanecem.
        expect(await prisma.company.count()).toBe(2);
    });
    it('S04: reinício repetido ou concorrente do mesmo ID devolve a mesma sucessora', async () => {
        const owner = await user('a@example.test');
        const { session: old } = await repository.createForOwner(owner.id, freshIdentity);
        const results = await Promise.all([
            repository.restart(old.id, owner.id, freshIdentity),
            repository.restart(old.id, owner.id, freshIdentity),
            repository.restart(old.id, owner.id, freshIdentity),
        ]);
        const later = await repository.restart(old.id, owner.id, freshIdentity);
        expect(new Set([...results, later].map((session) => session.id)).size).toBe(1);
        expect(await prisma.demoSession.count()).toBe(2);
        expect(await prisma.demoSession.count({ where: { state: 'ACTIVE' } })).toBe(1);
        expect(await prisma.company.count()).toBe(2);
    });
    it('runbook: excluir a empresa de uma sessão arquivada remove sessão, chaves e estoque e preserva ledger/telemetria', async () => {
        const owner = await user('a@example.test');
        const { session: old } = await repository.createForOwner(owner.id, freshIdentity);
        await repository.restart(old.id, owner.id, freshIdentity);
        await prisma.aiUsageLedger.create({
            data: { scope: 'global', scopeId: 'global', periodKind: 'day', period: '2026-10-10', spentRequests: 3 },
        });
        await prisma.aiCallEvent.create({
            data: { correlationId: crypto.randomUUID(), operation: 'invoice_extraction', model: 'm', status: 'success', durationMs: 1, attempts: 1, stockId: old.stockId },
        });
        await prisma.company.delete({ where: { id: old.companyId } });
        expect(await prisma.demoSession.findUnique({ where: { id: old.id } })).toBeNull();
        expect(await prisma.demoDocumentKey.count({ where: { sessionId: old.id } })).toBe(0);
        expect(await prisma.stock.count({ where: { id: old.stockId } })).toBe(0);
        // A sessão ativa (sucessora) e os registros compartilhados permanecem.
        expect(await prisma.demoSession.count({ where: { state: 'ACTIVE' } })).toBe(1);
        expect(await prisma.aiUsageLedger.count()).toBe(1);
        expect(await prisma.aiCallEvent.count()).toBe(1);
    });
    it('trata colisão de CNPJ com retry limitado', async () => {
        const [a, b] = [await user('a@example.test'), await user('b@example.test')];
        const first = await repository.createForOwner(a.id, freshIdentity);
        const takenCnpj = (await prisma.company.findUniqueOrThrow({ where: { id: first.session.companyId } })).cnpj;
        let calls = 0;
        const second = await repository.createForOwner(b.id, () => {
            calls += 1;
            return calls === 1 ? { ...freshIdentity(), cnpj: takenCnpj } : freshIdentity();
        });
        expect(second.created).toBe(true);
        expect(calls).toBe(2);
        expect(await prisma.company.count()).toBe(2);
    });
    it('S08: colisão persistente falha de forma limitada sem recursos parciais', async () => {
        const [a, b] = [await user('a@example.test'), await user('b@example.test')];
        const first = await repository.createForOwner(a.id, freshIdentity);
        const takenCnpj = (await prisma.company.findUniqueOrThrow({ where: { id: first.session.companyId } })).cnpj;
        let calls = 0;
        const error = await repository.createForOwner(b.id, () => {
            calls += 1;
            return { ...freshIdentity(), cnpj: takenCnpj };
        }).catch((e) => e);
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(503);
        expect(calls).toBeGreaterThan(1);
        expect(calls).toBeLessThanOrEqual(5);
        expect(await prisma.company.count()).toBe(1);
        expect(await prisma.demoSession.count()).toBe(1);
        expect(await prisma.demoDocumentKey.count()).toBe(2);
    });
    it('não reserva chave de acesso que já pertence a uma nota processada', async () => {
        const [a, b] = [await user('a@example.test'), await user('b@example.test')];
        const first = await repository.createForOwner(a.id, freshIdentity);
        const processedKey = deriveDemoAccessKey('processed-elsewhere', 'initial');
        await prisma.processedInvoice.create({ data: { accessKey: processedKey, stockId: first.session.stockId } });
        let calls = 0;
        const second = await repository.createForOwner(b.id, () => {
            calls += 1;
            const identity = freshIdentity();
            return calls === 1 ? { ...identity, accessKeys: { ...identity.accessKeys, initial: processedKey } } : identity;
        });
        expect(second.created).toBe(true);
        expect(calls).toBe(2);
        expect(await prisma.demoDocumentKey.findUnique({ where: { accessKey: processedKey } })).toBeNull();
    });
});
//# sourceMappingURL=demo-session.integration.spec.js.map