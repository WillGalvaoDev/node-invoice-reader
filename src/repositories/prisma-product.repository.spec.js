import { beforeEach, describe, expect, it, vi } from 'vitest';
const prismaMock = vi.hoisted(() => ({
    product: {
        create: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
    },
}));
vi.mock('../infra/prisma.js', () => ({ prisma: prismaMock }));
const { PrismaProductRepository } = await import('./prisma-product.repository.js');
describe('PrismaProductRepository pagination', () => {
    beforeEach(() => vi.clearAllMocks());
    it('pagina no banco por stock, sem filtro de creator, em ordem estavel', async () => {
        prismaMock.product.findMany.mockResolvedValue([
            { id: 'p3', code: '3', description: '3', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-1', userId: 'user-b', createdAt: new Date('2026-01-01') },
            { id: 'p2', code: '2', description: '2', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-1', userId: null, createdAt: new Date('2026-01-01') },
            { id: 'p1', code: '1', description: '1', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-1', userId: 'user-a', createdAt: new Date('2026-01-01') },
        ]);
        const page = await new PrismaProductRepository().findPageByStockId({ stockId: 'stock-1', limit: 2 });
        expect(prismaMock.product.findMany).toHaveBeenCalledWith({ where: { stockId: 'stock-1' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 3 });
        expect(page.items.map((item) => item.id)).toEqual(['p3', 'p2']);
        expect(page.nextCursor).toBe('p2');
    });
    it('aplica cursor exclusivo e encerra com nextCursor null', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const page = await new PrismaProductRepository().findPageByStockId({ stockId: 'stock-1', limit: 2, cursor: 'p2' });
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: 'p2' }, skip: 1 }));
        expect(page).toEqual({ items: [], nextCursor: null });
    });
});
describe('PrismaProductRepository constraints', () => {
    beforeEach(() => vi.clearAllMocks());
    it('usa findUnique com a identidade composta stockId + code', async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: 'product-a', code: 'SAME', description: 'Produto A', quantity: 1,
            unitMeasurement: 'UN', unitPrice: 2, totalPrice: 2, stockId: 'stock-a',
            userId: null, createdAt: new Date('2026-01-01'),
        });
        const found = await new PrismaProductRepository().findByCode('SAME', 'stock-a');
        expect(prismaMock.product.findUnique).toHaveBeenCalledWith({
            where: { stockId_code: { stockId: 'stock-a', code: 'SAME' } },
        });
        expect(found).toMatchObject({ id: 'product-a', stockId: 'stock-a', code: 'SAME' });
    });
    it('traduz P2002 ao criar produto sem expor detalhes Prisma', async () => {
        prismaMock.product.create.mockRejectedValueOnce({
            code: 'P2002', meta: { target: ['stockId', 'code'], modelName: 'Product' },
        });
        const promise = new PrismaProductRepository().save({
            code: 'DUP', description: 'Produto', quantity: 1, unitMeasurement: 'UN',
            unitPrice: 10, totalPrice: 10, stockId: 'stock-a',
        });
        await expect(promise).rejects.toMatchObject({
            name: 'AppError', statusCode: 409, message: 'Produto já cadastrado neste estoque.',
        });
    });
    it('traduz P2003 ao excluir produto referenciado como conflito', async () => {
        prismaMock.product.delete.mockRejectedValueOnce({
            code: 'P2003', meta: { constraint: 'product_similarity_suggestions_suggestedProductId_fkey' },
        });
        await expect(new PrismaProductRepository().delete('product-a')).rejects.toMatchObject({
            name: 'AppError', statusCode: 409,
            message: 'Produto possui referências e não pode ser removido.',
        });
    });
    it('não traduz erro Prisma desconhecido', async () => {
        const unknown = { code: 'P2025', meta: { modelName: 'Product' } };
        prismaMock.product.delete.mockRejectedValueOnce(unknown);
        await expect(new PrismaProductRepository().delete('missing')).rejects.toBe(unknown);
    });
});
//# sourceMappingURL=prisma-product.repository.spec.js.map