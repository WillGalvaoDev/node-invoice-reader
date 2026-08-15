import { describe, expect, it, vi } from 'vitest';
import { ListCompaniesController } from './list-companies.controller.js';
describe('ListCompaniesController', () => {
    it('aplica defaults validados e devolve o contrato paginado', async () => {
        const execute = vi.fn().mockResolvedValue({
            items: [{ id: 'company-1', name: 'Empresa', cnpj: '11222333000181', createdAt: new Date('2026-01-01'), role: 'OWNER' }],
            nextCursor: null,
        });
        const controller = new ListCompaniesController({ execute });
        const json = vi.fn();
        const response = { status: vi.fn().mockReturnValue({ json }) };
        await controller.handle({ user: { id: 'user-1' }, query: {} }, response);
        expect(execute).toHaveBeenCalledWith({ userId: 'user-1', limit: 50 });
        expect(response.status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            status: 'success',
            data: {
                items: [{ id: 'company-1', name: 'Empresa', cnpj: '11222333000181', createdAt: new Date('2026-01-01'), role: 'OWNER' }],
                nextCursor: null,
            },
        });
    });
    it('rejeita chamada sem usuário autenticado antes de consultar o use case', async () => {
        const execute = vi.fn();
        const controller = new ListCompaniesController({ execute });
        await expect(controller.handle({ user: undefined, query: {} }, {}))
            .rejects.toMatchObject({ statusCode: 401 });
        expect(execute).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=list-companies.controller.spec.js.map