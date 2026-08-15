import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryCompanyRepository } from '../../repositories/in-memory/in-memory-company.repository.js';
import { InMemoryStockRepository } from '../../repositories/in-memory/in-memory-stock.repository.js';
import { ListCompanyStocksUseCase } from './list-company-stocks.use-case.js';
describe('ListCompanyStocksUseCase', () => {
    let companies;
    let stocks;
    let sut;
    beforeEach(async () => {
        companies = new InMemoryCompanyRepository();
        stocks = new InMemoryStockRepository();
        await companies.create({ id: 'company-1', name: 'Empresa 1', cnpj: 'cnpj-1', ownerId: 'owner-1' });
        stocks.companyOwnerId.set('company-1', 'owner-1');
        sut = new ListCompanyStocksUseCase(companies, stocks);
    });
    async function seedStock(id, createdAt, companyId = 'company-1') {
        return stocks.create({ id, name: `Estoque ${id}`, companyId, createdAt });
    }
    it('owner lista todos os estoques da própria empresa, mesmo sem nenhuma StockPermission', async () => {
        await seedStock('stock-a', new Date('2026-01-01'));
        await seedStock('stock-b', new Date('2026-01-02'));
        const page = await sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 50 });
        expect(page.items.map((item) => item.id)).toEqual(['stock-b', 'stock-a']);
        expect(page.nextCursor).toBeNull();
    });
    it('collaborator com canView em um estoque vê apenas esse estoque', async () => {
        await companies.create({ id: 'company-1', name: 'Empresa 1', cnpj: 'cnpj-1', ownerId: 'owner-1' });
        companies.collaboratorUserIds.set('company-1', new Set(['collaborator-1']));
        await seedStock('stock-a', new Date('2026-01-01'));
        await seedStock('stock-b', new Date('2026-01-02'));
        stocks.viewAuthorizedUserIds.set('stock-a', new Set(['collaborator-1']));
        const page = await sut.execute({ userId: 'collaborator-1', companyId: 'company-1', limit: 50 });
        expect(page.items.map((item) => item.id)).toEqual(['stock-a']);
    });
    it('collaborator sem nenhum canView recebe 200 com lista vazia — CompanyCollaborator sozinho não dá acesso a estoque', async () => {
        companies.collaboratorUserIds.set('company-1', new Set(['collaborator-1']));
        await seedStock('stock-a', new Date('2026-01-01'));
        const page = await sut.execute({ userId: 'collaborator-1', companyId: 'company-1', limit: 50 });
        expect(page.items).toEqual([]);
        expect(page.nextCursor).toBeNull();
    });
    it('outsider (sem relação com a empresa) recebe 404, indistinguível de empresa inexistente', async () => {
        await seedStock('stock-a', new Date('2026-01-01'));
        await expect(sut.execute({ userId: 'outsider', companyId: 'company-1', limit: 50 }))
            .rejects.toMatchObject({ statusCode: 404 });
    });
    it('company inexistente recebe exatamente o mesmo 404 que outsider', async () => {
        const outsiderError = await sut.execute({ userId: 'outsider', companyId: 'company-1', limit: 50 }).catch((error) => error);
        const missingCompanyError = await sut.execute({ userId: 'owner-1', companyId: 'missing-company', limit: 50 }).catch((error) => error);
        expect(outsiderError.statusCode).toBe(404);
        expect(missingCompanyError.statusCode).toBe(404);
        expect(outsiderError.message).toBe(missingCompanyError.message);
    });
    it('usuário de outra empresa nunca vê estoques cross-tenant (sem relação → 404)', async () => {
        await companies.create({ id: 'company-2', name: 'Empresa 2', cnpj: 'cnpj-2', ownerId: 'owner-2' });
        stocks.companyOwnerId.set('company-2', 'owner-2');
        await seedStock('stock-a', new Date('2026-01-01'), 'company-1');
        await seedStock('stock-x', new Date('2026-01-01'), 'company-2');
        await expect(sut.execute({ userId: 'owner-2', companyId: 'company-1', limit: 50 }))
            .rejects.toMatchObject({ statusCode: 404 });
        const ownCompanyPage = await sut.execute({ userId: 'owner-2', companyId: 'company-2', limit: 50 });
        expect(ownCompanyPage.items.map((item) => item.id)).toEqual(['stock-x']);
    });
    it('não duplica um estoque mesmo que owner e permissão explícita coincidam', async () => {
        companies.collaboratorUserIds.set('company-1', new Set(['owner-1']));
        await seedStock('stock-a', new Date('2026-01-01'));
        stocks.viewAuthorizedUserIds.set('stock-a', new Set(['owner-1']));
        const page = await sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 50 });
        expect(page.items).toHaveLength(1);
    });
    it('pagina por cursor sem duplicar ou perder itens, inclusive em empate de createdAt', async () => {
        const sameDate = new Date('2026-01-01T00:00:00Z');
        for (const id of ['stock-a', 'stock-b', 'stock-c', 'stock-d', 'stock-e']) {
            await seedStock(id, sameDate);
        }
        const first = await sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 2 });
        const second = await sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 2, cursor: first.nextCursor });
        const third = await sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 2, cursor: second.nextCursor });
        expect([first.items.length, second.items.length, third.items.length]).toEqual([2, 2, 1]);
        expect(third.nextCursor).toBeNull();
        const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
        expect(new Set(ids).size).toBe(5);
    });
    it('rejeita cursor de estoque que o usuário não pode visualizar, mesmo dentro da mesma empresa', async () => {
        companies.collaboratorUserIds.set('company-1', new Set(['collaborator-1']));
        await seedStock('stock-a', new Date('2026-01-01'));
        await seedStock('stock-b', new Date('2026-01-02'));
        stocks.viewAuthorizedUserIds.set('stock-a', new Set(['collaborator-1']));
        // stock-b existe na mesma empresa, mas collaborator-1 não tem canView nele.
        await expect(sut.execute({ userId: 'collaborator-1', companyId: 'company-1', limit: 50, cursor: 'stock-b' }))
            .rejects.toMatchObject({ statusCode: 400 });
    });
    it('rejeita cursor de estoque pertencente a outra empresa', async () => {
        await companies.create({ id: 'company-2', name: 'Empresa 2', cnpj: 'cnpj-2', ownerId: 'owner-1' });
        stocks.companyOwnerId.set('company-2', 'owner-1');
        await seedStock('stock-a', new Date('2026-01-01'), 'company-1');
        await seedStock('stock-x', new Date('2026-01-01'), 'company-2');
        await expect(sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 50, cursor: 'stock-x' }))
            .rejects.toMatchObject({ statusCode: 400 });
    });
    it('rejeita cursor de estoque inexistente', async () => {
        await seedStock('stock-a', new Date('2026-01-01'));
        await expect(sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 50, cursor: 'missing-stock' }))
            .rejects.toMatchObject({ statusCode: 400 });
    });
    it('não expõe companyId nem campos internos — apenas id, name, createdAt', async () => {
        await seedStock('stock-a', new Date('2026-01-01'));
        const page = await sut.execute({ userId: 'owner-1', companyId: 'company-1', limit: 50 });
        expect(Object.keys(page.items[0]).sort()).toEqual(['createdAt', 'id', 'name']);
    });
});
//# sourceMappingURL=list-company-stocks.use-case.spec.js.map