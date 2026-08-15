import { describe, expect, it, vi } from 'vitest';
import { ListCompanyStocksController } from './list-company-stocks.controller.js';
describe('ListCompanyStocksController', () => {
    it('aplica defaults validados e devolve o contrato paginado', async () => {
        const execute = vi.fn().mockResolvedValue({
            items: [{ id: 'stock-1', name: 'Estoque Principal', createdAt: new Date('2026-01-01') }],
            nextCursor: null,
        });
        const controller = new ListCompanyStocksController({ execute });
        const json = vi.fn();
        const response = { status: vi.fn().mockReturnValue({ json }) };
        await controller.handle({
            user: { id: 'user-1' },
            params: { companyId: 'company-1' },
            query: {},
        }, response);
        expect(execute).toHaveBeenCalledWith({ userId: 'user-1', companyId: 'company-1', limit: 50 });
        expect(response.status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            status: 'success',
            data: {
                items: [{ id: 'stock-1', name: 'Estoque Principal', createdAt: new Date('2026-01-01') }],
                nextCursor: null,
            },
        });
    });
    it('rejeita chamada sem usuário autenticado antes de consultar o use case', async () => {
        const execute = vi.fn();
        const controller = new ListCompanyStocksController({ execute });
        await expect(controller.handle({
            user: undefined,
            params: { companyId: 'company-1' },
            query: {},
        }, {})).rejects.toMatchObject({ statusCode: 401 });
        expect(execute).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=list-company-stocks.controller.spec.js.map