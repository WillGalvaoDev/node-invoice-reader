import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProductSuggestionUseCase } from './confirm-product-suggestion.use-case.js';
import { RejectProductSuggestionUseCase } from './reject-product-suggestion.use-case.js';
import { ListPendingProductSuggestionsUseCase } from './list-pending-product-suggestions.use-case.js';
describe('product suggestion lifecycle', () => {
    const suggestion = {
        id: '11111111-1111-4111-8111-111111111111', processedInvoiceId: 'invoice-1', itemIndex: 0,
        stockId: 'stock-1', suggestedProductId: 'product-1', receivedCode: 'SUP-1',
        receivedDescription: 'Produto recebido', receivedQuantity: 5, receivedUnitPrice: 20,
        unitMeasurement: 'UN', confidence: 0.88, reason: 'equivalente', status: 'PENDING',
        decidedAt: null, decidedByUserId: null, createdAt: new Date(),
    };
    const repository = {
        findById: vi.fn(), findPendingByStockId: vi.fn(), confirm: vi.fn(), reject: vi.fn(),
    };
    const stocks = { findByIdForUser: vi.fn() };
    const telemetry = { recordCall: vi.fn(), recordSuggestion: vi.fn() };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    beforeEach(() => {
        vi.clearAllMocks();
        repository.findById.mockResolvedValue(suggestion);
        repository.findPendingByStockId.mockResolvedValue([suggestion]);
        stocks.findByIdForUser.mockResolvedValue({ id: 'stock-1', companyId: 'company-1', name: 'Stock' });
        repository.confirm.mockResolvedValue({ ...suggestion, status: 'CONFIRMED', decidedByUserId: 'user-1', decidedAt: new Date() });
        repository.reject.mockResolvedValue({ ...suggestion, status: 'REJECTED', decidedByUserId: 'user-1', decidedAt: new Date() });
    });
    it('confirma usando somente suggestion e usuario, depois de autorizar o stock derivado', async () => {
        const result = await new ConfirmProductSuggestionUseCase(repository, stocks).execute({ suggestionId: suggestion.id, userId: 'user-1' });
        expect(stocks.findByIdForUser).toHaveBeenCalledWith('stock-1', 'user-1');
        expect(repository.confirm).toHaveBeenCalledWith(suggestion.id, 'user-1');
        expect(result.status).toBe('CONFIRMED');
    });
    it('bloqueia outsider antes de qualquer decisao', async () => {
        stocks.findByIdForUser.mockResolvedValueOnce(null);
        await expect(new ConfirmProductSuggestionUseCase(repository, stocks).execute({ suggestionId: suggestion.id, userId: 'outsider' }))
            .rejects.toMatchObject({ statusCode: 403 });
        expect(repository.confirm).not.toHaveBeenCalled();
    });
    it('retorna 404 para suggestion inexistente', async () => {
        repository.findById.mockResolvedValueOnce(null);
        await expect(new RejectProductSuggestionUseCase(repository, stocks).execute({ suggestionId: suggestion.id, userId: 'user-1' }))
            .rejects.toMatchObject({ statusCode: 404 });
    });
    it('rejeita somente depois de autorizar e delega a transicao atomica', async () => {
        const result = await new RejectProductSuggestionUseCase(repository, stocks).execute({ suggestionId: suggestion.id, userId: 'user-1' });
        expect(repository.reject).toHaveBeenCalledWith(suggestion.id, 'user-1');
        expect(result.status).toBe('REJECTED');
    });
    it('lista apenas pending de um stock autorizado', async () => {
        const result = await new ListPendingProductSuggestionsUseCase(repository, stocks).execute({ stockId: 'stock-1', userId: 'user-1' });
        expect(repository.findPendingByStockId).toHaveBeenCalledWith('stock-1');
        expect(result).toEqual([suggestion]);
    });
    it.each([
        ['confirmed', ConfirmProductSuggestionUseCase, 'confirm'],
        ['rejected', RejectProductSuggestionUseCase, 'reject'],
    ])('registra decisão %s somente após a transição persistida', async (decision, UseCase, repositoryMethod) => {
        const result = await new UseCase(repository, stocks, telemetry, logger)
            .execute({ suggestionId: suggestion.id, userId: 'user-1' });
        expect(repository[repositoryMethod]).toHaveBeenCalledOnce();
        expect(telemetry.recordSuggestion).toHaveBeenCalledWith({ decision, confidence: 0.88 });
        expect(result.status).toBe(decision === 'confirmed' ? 'CONFIRMED' : 'REJECTED');
    });
    it('não registra decisão falha nem deixa falha da telemetria desfazer confirmação', async () => {
        repository.confirm.mockRejectedValueOnce(new Error('transition failed'));
        await expect(new ConfirmProductSuggestionUseCase(repository, stocks, telemetry, logger)
            .execute({ suggestionId: suggestion.id, userId: 'user-1' })).rejects.toThrow('transition failed');
        expect(telemetry.recordSuggestion).not.toHaveBeenCalled();
        repository.confirm.mockResolvedValueOnce({ ...suggestion, status: 'CONFIRMED' });
        telemetry.recordSuggestion.mockImplementationOnce(() => { throw new Error('telemetry unavailable'); });
        await expect(new ConfirmProductSuggestionUseCase(repository, stocks, telemetry, logger)
            .execute({ suggestionId: suggestion.id, userId: 'user-1' })).resolves.toMatchObject({ status: 'CONFIRMED' });
        expect(logger.warn).toHaveBeenCalledWith('AI telemetry recording failed', expect.objectContaining({
            event: 'ai_suggestion', decision: 'confirmed', error: { name: 'Error' },
        }));
    });
});
//# sourceMappingURL=product-suggestion.use-cases.spec.js.map