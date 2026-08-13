import { beforeEach, describe, expect, it, vi } from 'vitest';
const prismaMock = vi.hoisted(() => ({
    stock: { create: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('../infra/prisma.js', () => ({ prisma: prismaMock }));
const { PrismaStockRepository } = await import('./prisma-stock.repository.js');
describe('PrismaStockRepository authorization', () => {
    beforeEach(() => vi.clearAllMocks());
    it('autoriza criação somente para owner ou collaborator com canCreate no estoque', async () => {
        prismaMock.stock.findFirst.mockResolvedValueOnce({ id: 'stock-1', name: 'Estoque', companyId: 'company-1' });
        const result = await new PrismaStockRepository().findByIdForUser('stock-1', 'user-1');
        expect(prismaMock.stock.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'stock-1',
                company: {
                    OR: [
                        { ownerId: 'user-1' },
                        {
                            collaborators: {
                                some: {
                                    userId: 'user-1',
                                    permissions: { some: { stockId: 'stock-1', canCreate: true } },
                                },
                            },
                        },
                    ],
                },
            },
        });
        expect(result?.id).toBe('stock-1');
    });
    it('autoriza leitura para owner ou collaborator com canView no estoque', async () => {
        prismaMock.stock.findFirst.mockResolvedValueOnce({ id: 'stock-1', name: 'Estoque', companyId: 'company-1' });
        await new PrismaStockRepository().findByIdForViewer('stock-1', 'user-1');
        expect(prismaMock.stock.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'stock-1',
                company: {
                    OR: [
                        { ownerId: 'user-1' },
                        { collaborators: { some: { userId: 'user-1', permissions: { some: { stockId: 'stock-1', canView: true } } } } },
                    ],
                },
            },
        });
    });
});
describe('PrismaStockRepository constraints', () => {
    beforeEach(() => vi.clearAllMocks());
    it('traduz P2002 de nome duplicado na mesma company para 409', async () => {
        prismaMock.stock.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['companyId', 'name'] } });
        await expect(new PrismaStockRepository().create({ name: 'Estoque Principal', companyId: 'company-1' }))
            .rejects.toMatchObject({ name: 'AppError', statusCode: 409, message: 'Já existe um estoque com este nome nesta empresa.' });
    });
    it('traduz P2003 de company inexistente para 400', async () => {
        prismaMock.stock.create.mockRejectedValueOnce({ code: 'P2003', meta: { field_name: 'companyId' } });
        await expect(new PrismaStockRepository().create({ name: 'Estoque', companyId: 'missing-company' }))
            .rejects.toMatchObject({ name: 'AppError', statusCode: 400, message: 'Empresa relacionada inválida.' });
    });
});
//# sourceMappingURL=prisma-stock.repository.spec.js.map