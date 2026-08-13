import { describe, expect, it, vi } from 'vitest';
import { ListProductsController } from './list-products.controller.js';
describe('ListProductsController', () => {
    it('aplica defaults validados e devolve o contrato paginado', async () => {
        const execute = vi.fn().mockResolvedValue({ items: [{ id: 'product-1' }], nextCursor: null });
        const controller = new ListProductsController({ execute });
        const json = vi.fn();
        const response = { status: vi.fn().mockReturnValue({ json }) };
        await controller.handle({ user: { id: 'user-1' }, query: { stockId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, response);
        expect(execute).toHaveBeenCalledWith({ userId: 'user-1', stockId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', limit: 50 });
        expect(json).toHaveBeenCalledWith({ status: 'success', data: { items: [{ id: 'product-1' }], nextCursor: null } });
    });
});
//# sourceMappingURL=list-products.controller.spec.js.map