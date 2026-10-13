import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
import { AppError } from '../../errors/app-error.js';
const SUPPLIER = '11222333000181';
const OTHER_SUPPLIER = '45723174000110';
describe('ReadInvoiceUseCase — correspondência exata segura (I01)', () => {
    const storage = { readFile: vi.fn(), deleteFile: vi.fn() };
    const ai = { extractDanfeData: vi.fn(), findSimilarProduct: vi.fn() };
    const products = {
        save: vi.fn(), findByCode: vi.fn(), findByStockId: vi.fn(), findPageByStockId: vi.fn(),
        findById: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
    const audit = { create: vi.fn(), findByCompanyId: vi.fn(), findByUserId: vi.fn() };
    const stocks = { create: vi.fn(), findById: vi.fn(), findByIdForUser: vi.fn(), findByCompanyId: vi.fn() };
    const persistence = { persist: vi.fn() };
    const invoice = (unitMeasurement = 'UN', cnpj = SUPPLIER) => ({
        accessKey: '1'.repeat(44), invoiceNumber: '1', series: '1', issuedAt: new Date(), totalValue: 2,
        supplier: { cnpj, name: 'Supplier' },
        products: [{ code: 'CAN-A', description: 'Caneta', quantity: 2, unitMeasurement, unitPrice: 1, totalPrice: 2 }],
    });
    const existing = (overrides = {}) => ({
        id: 'p1', code: 'CAN-A', description: 'Caneta', quantity: 10, unitMeasurement: 'UN',
        unitPrice: 2, totalPrice: 20, stockId: 'stock-1', sourceSupplierCnpj: SUPPLIER, ...overrides,
    });
    beforeEach(() => {
        vi.clearAllMocks();
        storage.deleteFile.mockResolvedValue(undefined);
        stocks.findByIdForUser.mockResolvedValue({ id: 'stock-1', companyId: 'company-1', name: 'Stock' });
        ai.extractDanfeData.mockResolvedValue(invoice());
        ai.findSimilarProduct.mockResolvedValue({ kind: 'no_match' });
        products.findByCode.mockResolvedValue(null);
        persistence.persist.mockImplementation(async ({ operations }) => operations.map(({ product }) => product));
    });
    const run = () => new ReadInvoiceUseCase(storage, ai, products, audit, stocks, persistence)
        .execute({ filePath: '/tmp/invoice', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' });
    it('I-T01: mesmo fornecedor, código e unidade normalizada acumula uma única vez', async () => {
        products.findByStockId.mockResolvedValue([existing({ unitMeasurement: ' un ' })]);
        await run();
        expect(persistence.persist).toHaveBeenCalledOnce();
        const [{ operations }] = persistence.persist.mock.calls[0];
        expect(operations).toHaveLength(1);
        expect(operations[0].product).toMatchObject({ code: 'CAN-A', quantity: 2, sourceSupplierCnpj: SUPPLIER });
    });
    it.each([
        ['I-T02: fornecedor diferente', existing({ sourceSupplierCnpj: OTHER_SUPPLIER }), invoice()],
        ['I-T03: unidade UN × CX', existing(), invoice('CX')],
        ['I-T04: produto legado sem origem', existing({ sourceSupplierCnpj: null }), invoice()],
    ])('%s: 422, nenhuma escrita e arquivo temporário removido', async (_name, product, extracted) => {
        products.findByStockId.mockResolvedValue([product]);
        ai.extractDanfeData.mockResolvedValue(extracted);
        const error = await run().catch((e) => e);
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(422);
        expect(persistence.persist).not.toHaveBeenCalled();
        expect(audit.create).not.toHaveBeenCalled();
        expect(storage.deleteFile).toHaveBeenCalledWith('/tmp/invoice');
    });
    it('propaga a origem do fornecedor para produtos novos e sugestões', async () => {
        products.findByStockId.mockResolvedValue([existing({ id: 'p9', code: 'OUTRO', description: 'Caneta azul' })]);
        ai.extractDanfeData.mockResolvedValue({
            ...invoice(),
            products: [{ code: 'NOVO', description: 'Caneta azul fina', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1 }],
        });
        ai.findSimilarProduct.mockResolvedValue({ kind: 'match', product: existing({ id: 'p9', code: 'OUTRO' }), confidence: 0.9, reason: 'igual' });
        await run();
        const [plan] = persistence.persist.mock.calls[0];
        expect(plan.suggestions[0]).toMatchObject({ receivedCode: 'NOVO', receivedSupplierCnpj: SUPPLIER });
    });
    it('produto novo conserva a origem recebida', async () => {
        products.findByStockId.mockResolvedValue([]);
        await run();
        const [{ operations }] = persistence.persist.mock.calls[0];
        expect(operations[0].product).toMatchObject({ code: 'CAN-A', sourceSupplierCnpj: SUPPLIER });
    });
});
//# sourceMappingURL=read-invoice.origin-conflict.spec.js.map