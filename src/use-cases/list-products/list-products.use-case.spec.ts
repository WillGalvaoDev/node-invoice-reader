import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '../../repositories/in-memory/in-memory-product.repository.js';
import { InMemoryStockRepository } from '../../repositories/in-memory/in-memory-stock.repository.js';
import { ListProductsUseCase } from './list-products.use-case.js';

describe('ListProductsUseCase', () => {
  let products: InMemoryProductRepository;
  let stocks: InMemoryStockRepository;
  let sut: ListProductsUseCase;

  beforeEach(async () => {
    products = new InMemoryProductRepository();
    stocks = new InMemoryStockRepository();
    await stocks.create({ id: 'stock-1', name: 'Estoque 1', companyId: 'company-1' });
    stocks.viewAuthorizedUserIds.set('stock-1', new Set(['owner', 'collaborator-a', 'collaborator-b']));
    sut = new ListProductsUseCase(products, stocks);
  });

  async function seed(code: string, userId: string | null, createdAt: Date) {
    return products.save({ code, description: code, quantity: 1, unitMeasurement: 'UN', unitPrice: 10, totalPrice: 10, stockId: 'stock-1', userId, createdAt });
  }

  it('lista o mesmo conjunto do estoque para owner e colaboradores autorizados, preservando autoria', async () => {
    await seed('OWNER', 'owner', new Date('2026-01-01T00:00:00Z'));
    await seed('COLLAB-A', 'collaborator-a', new Date('2026-01-02T00:00:00Z'));
    await seed('COLLAB-B', 'collaborator-b', new Date('2026-01-03T00:00:00Z'));
    const pages = await Promise.all(['owner', 'collaborator-a', 'collaborator-b'].map((userId) => sut.execute({ userId, stockId: 'stock-1', limit: 50 })));
    const [ownerPage, collaboratorAPage, collaboratorBPage] = pages;
    expect(ownerPage!.items.map((item) => item.code)).toEqual(['COLLAB-B', 'COLLAB-A', 'OWNER']);
    expect(collaboratorAPage!.items).toEqual(ownerPage!.items);
    expect(collaboratorBPage!.items).toEqual(ownerPage!.items);
    expect(ownerPage!.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'COLLAB-A', userId: 'collaborator-a' }),
      expect.objectContaining({ code: 'COLLAB-B', userId: 'collaborator-b' }),
    ]));
  });

  it('lista produto criado por outro usuario e produto cujo creator foi removido', async () => {
    // Substitui a expectativa antiga e incorreta de filtrar pelo criador autenticado.
    await seed('OTHER-CREATOR', 'collaborator-b', new Date('2026-01-02T00:00:00Z'));
    await seed('REMOVED-CREATOR', null, new Date('2026-01-01T00:00:00Z'));
    const page = await sut.execute({ userId: 'collaborator-a', stockId: 'stock-1', limit: 50 });
    expect(page.items.map((item) => item.code)).toEqual(['OTHER-CREATOR', 'REMOVED-CREATOR']);
    expect(page.items[1]).toMatchObject({ userId: null, stockId: 'stock-1' });
  });

  it('nega outsider antes de consultar produtos', async () => {
    const listSpy = vi.spyOn(products, 'findPageByStockId');
    await expect(sut.execute({ userId: 'outsider', stockId: 'stock-1', limit: 50 })).rejects.toMatchObject({ statusCode: 403 });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('pagina por cursor sem duplicar ou perder itens, inclusive em empate de createdAt', async () => {
    const sameDate = new Date('2026-01-01T00:00:00Z');
    for (const code of ['A', 'B', 'C', 'D', 'E']) await seed(code, 'owner', sameDate);
    const first = await sut.execute({ userId: 'owner', stockId: 'stock-1', limit: 2 });
    const second = await sut.execute({ userId: 'owner', stockId: 'stock-1', limit: 2, cursor: first.nextCursor! });
    const third = await sut.execute({ userId: 'owner', stockId: 'stock-1', limit: 2, cursor: second.nextCursor! });
    expect([first.items.length, second.items.length, third.items.length]).toEqual([2, 2, 1]);
    expect(third.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('rejeita cursor inexistente ou pertencente a outro estoque', async () => {
    await products.save({ id: 'other-stock-product', code: 'OTHER', description: 'Other', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-2', userId: 'owner' });
    await expect(sut.execute({ userId: 'owner', stockId: 'stock-1', limit: 50, cursor: 'missing' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(sut.execute({ userId: 'owner', stockId: 'stock-1', limit: 50, cursor: 'other-stock-product' })).rejects.toMatchObject({ statusCode: 400 });
  });
});
