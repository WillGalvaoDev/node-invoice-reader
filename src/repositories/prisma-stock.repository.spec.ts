import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  stock: { findFirst: vi.fn() },
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
});
