import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryCompanyRepository } from '../../repositories/in-memory/in-memory-company.repository.js';
import { ListCompaniesUseCase } from './list-companies.use-case.js';
describe('ListCompaniesUseCase', () => {
    let companies;
    let sut;
    beforeEach(() => {
        companies = new InMemoryCompanyRepository();
        sut = new ListCompaniesUseCase(companies);
    });
    async function seedCompany(id, ownerId, createdAt, cnpj = `cnpj-${id}`) {
        return companies.create({ id, name: `Empresa ${id}`, cnpj, ownerId, createdAt });
    }
    it('lista a empresa própria do usuário autenticado, com role OWNER', async () => {
        await seedCompany('company-1', 'owner-1', new Date('2026-01-01'));
        const page = await sut.execute({ userId: 'owner-1', limit: 50 });
        expect(page.items).toEqual([
            expect.objectContaining({ id: 'company-1', name: 'Empresa company-1', role: 'OWNER' }),
        ]);
        expect(page.nextCursor).toBeNull();
    });
    it('usuário sem nenhuma empresa recebe página vazia, nunca 403/404', async () => {
        const page = await sut.execute({ userId: 'stranger', limit: 50 });
        expect(page).toEqual({ items: [], nextCursor: null });
    });
    it('usuário A nunca vê empresa de usuário B', async () => {
        await seedCompany('company-a', 'user-a', new Date('2026-01-01'));
        await seedCompany('company-b', 'user-b', new Date('2026-01-02'));
        const pageA = await sut.execute({ userId: 'user-a', limit: 50 });
        const pageB = await sut.execute({ userId: 'user-b', limit: 50 });
        expect(pageA.items.map((item) => item.id)).toEqual(['company-a']);
        expect(pageB.items.map((item) => item.id)).toEqual(['company-b']);
    });
    it('colaborador vê a empresa com role COLLABORATOR; owner da mesma empresa vê OWNER', async () => {
        await seedCompany('company-1', 'owner-1', new Date('2026-01-01'));
        companies.collaboratorUserIds.set('company-1', new Set(['collaborator-1']));
        const ownerPage = await sut.execute({ userId: 'owner-1', limit: 50 });
        const collaboratorPage = await sut.execute({ userId: 'collaborator-1', limit: 50 });
        expect(ownerPage.items[0]).toMatchObject({ id: 'company-1', role: 'OWNER' });
        expect(collaboratorPage.items[0]).toMatchObject({ id: 'company-1', role: 'COLLABORATOR' });
    });
    it('usuário sem vínculo de colaboração não vê a empresa de outrem', async () => {
        await seedCompany('company-1', 'owner-1', new Date('2026-01-01'));
        const page = await sut.execute({ userId: 'outsider-collaborator', limit: 50 });
        expect(page.items).toEqual([]);
    });
    it('não duplica a empresa mesmo que o usuário satisfaça owner e collaborator ao mesmo tempo', async () => {
        await seedCompany('company-1', 'user-1', new Date('2026-01-01'));
        companies.collaboratorUserIds.set('company-1', new Set(['user-1']));
        const page = await sut.execute({ userId: 'user-1', limit: 50 });
        expect(page.items).toHaveLength(1);
    });
    it('pagina por cursor sem duplicar ou perder itens, inclusive em empate de createdAt', async () => {
        const sameDate = new Date('2026-01-01T00:00:00Z');
        for (const id of ['company-a', 'company-b', 'company-c', 'company-d', 'company-e']) {
            await seedCompany(id, 'owner-1', sameDate);
        }
        const first = await sut.execute({ userId: 'owner-1', limit: 2 });
        const second = await sut.execute({ userId: 'owner-1', limit: 2, cursor: first.nextCursor });
        const third = await sut.execute({ userId: 'owner-1', limit: 2, cursor: second.nextCursor });
        expect([first.items.length, second.items.length, third.items.length]).toEqual([2, 2, 1]);
        expect(third.nextCursor).toBeNull();
        const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
        expect(new Set(ids).size).toBe(5);
    });
    it('rejeita cursor inexistente ou de empresa inacessível ao usuário', async () => {
        await seedCompany('company-1', 'owner-1', new Date('2026-01-01'));
        await seedCompany('company-2', 'other-owner', new Date('2026-01-02'));
        await expect(sut.execute({ userId: 'owner-1', limit: 50, cursor: 'missing' }))
            .rejects.toMatchObject({ statusCode: 400 });
        await expect(sut.execute({ userId: 'owner-1', limit: 50, cursor: 'company-2' }))
            .rejects.toMatchObject({ statusCode: 400 });
    });
    it('não expõe ownerId nem campos internos — apenas id, name, cnpj, createdAt, role', async () => {
        await seedCompany('company-1', 'owner-1', new Date('2026-01-01'));
        const page = await sut.execute({ userId: 'owner-1', limit: 50 });
        expect(Object.keys(page.items[0]).sort()).toEqual(['cnpj', 'createdAt', 'id', 'name', 'role']);
    });
});
//# sourceMappingURL=list-companies.use-case.spec.js.map