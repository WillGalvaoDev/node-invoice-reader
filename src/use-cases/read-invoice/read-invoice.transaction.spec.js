import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
describe('ReadInvoiceUseCase transaction phases', () => {
    const storage = { readFile: vi.fn(), deleteFile: vi.fn() };
    const ai = { extractDanfeData: vi.fn(), findSimilarProduct: vi.fn() };
    const products = {
        save: vi.fn(), findByCode: vi.fn(), findByUserId: vi.fn(), findByStockId: vi.fn(),
        findByCompanyId: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
    const audit = { create: vi.fn(), findByCompanyId: vi.fn(), findByUserId: vi.fn() };
    const stocks = { create: vi.fn(), findById: vi.fn(), findByIdForUser: vi.fn(), findByCompanyId: vi.fn() };
    const persistence = { persist: vi.fn() };
    const invoice = {
        accessKey: '1'.repeat(44), invoiceNumber: '1', series: '1', issuedAt: new Date(), totalValue: 2,
        supplier: { cnpj: '11222333000181', name: 'Supplier' },
        products: [
            { code: 'A', description: 'A', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1 },
            { code: 'B', description: 'B', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1 },
        ],
    };
    beforeEach(() => {
        vi.clearAllMocks();
        storage.deleteFile.mockResolvedValue(undefined);
        stocks.findByIdForUser.mockResolvedValue({ id: 'stock-1', companyId: 'company-1', name: 'Stock' });
        ai.extractDanfeData.mockResolvedValue(invoice);
        ai.findSimilarProduct.mockResolvedValue({ kind: 'no_match' });
        products.findByStockId.mockResolvedValue([
            { id: 'candidate', code: 'C', description: 'Candidate', stockId: 'stock-1' },
        ]);
        products.findByCode.mockResolvedValue(null);
        persistence.persist.mockImplementation(async ({ operations }) => operations.map(({ product }) => product));
    });
    function makeSut() {
        return new ReadInvoiceUseCase(storage, ai, products, audit, stocks, persistence);
    }
    it('prepara extração e decisões antes de iniciar a persistência transacional', async () => {
        const order = [];
        ai.extractDanfeData.mockImplementation(async () => { order.push('extract'); return invoice; });
        ai.findSimilarProduct.mockImplementation(async () => { order.push('similarity'); return { kind: 'no_match' }; });
        persistence.persist.mockImplementation(async ({ operations }) => { order.push('transaction'); return operations; });
        audit.create.mockImplementation(async (log) => { order.push('audit'); return log; });
        await makeSut().execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' });
        expect(order).toEqual(['extract', 'similarity', 'similarity', 'transaction', 'audit']);
    });
    it('envia todos os itens para uma única persistência e audita somente depois do sucesso', async () => {
        await makeSut().execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' });
        expect(persistence.persist).toHaveBeenCalledOnce();
        expect(persistence.persist.mock.calls[0]?.[0].operations).toHaveLength(2);
        expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE', entity: 'INVOICE', companyId: 'company-1',
        }));
        expect(products.save).not.toHaveBeenCalled();
        expect(products.update).not.toHaveBeenCalled();
        expect(audit.create).toHaveBeenCalledTimes(3);
        expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE', entity: 'PRODUCT', stockId: 'stock-1', previousState: null,
        }));
    });
    it('propaga falha transacional sem realizar escrita por outro caminho', async () => {
        persistence.persist.mockRejectedValueOnce(new Error('item N failed'));
        await expect(makeSut().execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' }))
            .rejects.toThrow('item N failed');
        expect(products.save).not.toHaveBeenCalled();
        expect(products.update).not.toHaveBeenCalled();
        expect(audit.create).not.toHaveBeenCalled();
    });
    it('mantém sugestão incerta fora do plano de escrita', async () => {
        ai.findSimilarProduct.mockResolvedValueOnce({
            kind: 'match',
            product: { id: 'existing', code: 'X', description: 'Similar', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-1' },
            confidence: 0.9,
            reason: 'similar',
        });
        const result = await makeSut().execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' });
        expect(result.suggestions).toHaveLength(1);
        expect(persistence.persist.mock.calls[0]?.[0].operations).toHaveLength(1);
    });
    it('mantém autorização antes da persistência', async () => {
        stocks.findByIdForUser.mockResolvedValueOnce(null);
        await expect(makeSut().execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'other-stock', userId: 'outsider' }))
            .rejects.toMatchObject({ statusCode: 403 });
        expect(ai.extractDanfeData).not.toHaveBeenCalled();
        expect(persistence.persist).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=read-invoice.transaction.spec.js.map