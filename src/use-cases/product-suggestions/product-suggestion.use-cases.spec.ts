import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProductSuggestionUseCase } from './confirm-product-suggestion.use-case.js';
import { RejectProductSuggestionUseCase } from './reject-product-suggestion.use-case.js';
import { ListPendingProductSuggestionsUseCase } from './list-pending-product-suggestions.use-case.js';

describe('product suggestion lifecycle', () => {
  const suggestion = {
    id: '11111111-1111-4111-8111-111111111111', processedInvoiceId: 'invoice-1', itemIndex: 0,
    stockId: 'stock-1', suggestedProductId: 'product-1', receivedCode: 'SUP-1',
    receivedDescription: 'Produto recebido', receivedQuantity: 5, receivedUnitPrice: 20,
    unitMeasurement: 'UN', confidence: 0.88, reason: 'equivalente', status: 'PENDING' as const,
    decidedAt: null, decidedByUserId: null, createdAt: new Date(),
  };
  const repository = {
    findById: vi.fn(), findPendingByStockId: vi.fn(), confirm: vi.fn(), reject: vi.fn(),
  };
  const stocks = { findByIdForUser: vi.fn() };
  const auditLogRepository = { create: vi.fn(), findByCompanyId: vi.fn(), findByUserId: vi.fn() };
  const telemetry = { recordCall: vi.fn(), recordSuggestion: vi.fn() };
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  const decidedProduct = { productId: 'product-1', previousProduct: { quantity: 10, unitPrice: 2, totalPrice: 20 }, nextProduct: { quantity: 15, unitPrice: 3, totalPrice: 45 } };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(suggestion);
    repository.findPendingByStockId.mockResolvedValue([suggestion]);
    stocks.findByIdForUser.mockResolvedValue({ id: 'stock-1', companyId: 'company-1', name: 'Stock' });
    auditLogRepository.create.mockResolvedValue({ id: 'log-1', action: 'UPDATE', entity: 'PRODUCT' });
    repository.confirm.mockResolvedValue({
      suggestion: { ...suggestion, status: 'CONFIRMED', decidedByUserId: 'user-1', decidedAt: new Date() }, ...decidedProduct,
    });
    repository.reject.mockResolvedValue({
      suggestion: { ...suggestion, status: 'REJECTED', decidedByUserId: 'user-1', decidedAt: new Date() }, ...decidedProduct,
    });
  });

  it('confirma usando somente suggestion e usuario, depois de autorizar o stock derivado', async () => {
    const result = await new ConfirmProductSuggestionUseCase(repository, stocks, auditLogRepository).execute({ suggestionId: suggestion.id, userId: 'user-1' });

    expect(stocks.findByIdForUser).toHaveBeenCalledWith('stock-1', 'user-1');
    expect(repository.confirm).toHaveBeenCalledWith(suggestion.id, 'user-1');
    expect(result.status).toBe('CONFIRMED');
  });

  it('bloqueia outsider antes de qualquer decisao', async () => {
    stocks.findByIdForUser.mockResolvedValueOnce(null);

    await expect(new ConfirmProductSuggestionUseCase(repository, stocks, auditLogRepository).execute({ suggestionId: suggestion.id, userId: 'outsider' }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(repository.confirm).not.toHaveBeenCalled();
  });

  it('retorna 404 para suggestion inexistente', async () => {
    repository.findById.mockResolvedValueOnce(null);
    await expect(new RejectProductSuggestionUseCase(repository, stocks, auditLogRepository).execute({ suggestionId: suggestion.id, userId: 'user-1' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejeita somente depois de autorizar e delega a transicao atomica', async () => {
    const result = await new RejectProductSuggestionUseCase(repository, stocks, auditLogRepository).execute({ suggestionId: suggestion.id, userId: 'user-1' });
    expect(repository.reject).toHaveBeenCalledWith(suggestion.id, 'user-1');
    expect(result.status).toBe('REJECTED');
  });

  it.each([
    ['confirmed', ConfirmProductSuggestionUseCase, 'UPDATE'],
    ['rejected', RejectProductSuggestionUseCase, 'UPDATE'],
  ] as const)('P3-00A: audita decisão %s como PRODUCT:%s com apenas os três números, sem descrição de invoice', async (decision, UseCase, _expectedAction) => {
    await new UseCase(repository, stocks, auditLogRepository).execute({ suggestionId: suggestion.id, userId: 'user-1' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE', entity: 'PRODUCT', entityId: 'product-1',
      userId: 'user-1', companyId: 'company-1', stockId: 'stock-1',
      previousState: { quantity: 10, unitPrice: 2, totalPrice: 20 },
      newState: { quantity: 15, unitPrice: 3, totalPrice: 45 },
      description: expect.stringContaining(decision === 'confirmed' ? 'confirmada' : 'rejeitada'),
    }));
    expect(auditLogRepository.create.mock.calls[0]?.[0].description).not.toContain('invoice');
  });

  it('P3-00A: audita PRODUCT:CREATE quando a decisão não tem produto anterior (produto novo)', async () => {
    repository.confirm.mockResolvedValueOnce({
      suggestion: { ...suggestion, status: 'CONFIRMED' },
      productId: 'product-new', previousProduct: null, nextProduct: { quantity: 5, unitPrice: 20, totalPrice: 100 },
    });

    await new ConfirmProductSuggestionUseCase(repository, stocks, auditLogRepository).execute({ suggestionId: suggestion.id, userId: 'user-1' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE', entity: 'PRODUCT', entityId: 'product-new', previousState: null,
      newState: { quantity: 5, unitPrice: 20, totalPrice: 100 },
    }));
  });

  it('P3-00A: falha na escrita do audit log não reverte a confirmação/rejeição', async () => {
    auditLogRepository.create.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(new ConfirmProductSuggestionUseCase(repository, stocks, auditLogRepository, telemetry, logger).execute({ suggestionId: suggestion.id, userId: 'user-1' }))
      .resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(logger.error).toHaveBeenCalledWith('Failed to persist audit log', expect.objectContaining({
      action: 'UPDATE', entity: 'PRODUCT', error: { name: 'Error' },
    }));
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('audit unavailable');
  });

  it('lista apenas pending de um stock autorizado', async () => {
    const result = await new ListPendingProductSuggestionsUseCase(repository, stocks).execute({ stockId: 'stock-1', userId: 'user-1' });
    expect(repository.findPendingByStockId).toHaveBeenCalledWith('stock-1');
    expect(result).toEqual([suggestion]);
  });

  it.each([
    ['confirmed', ConfirmProductSuggestionUseCase, 'confirm'],
    ['rejected', RejectProductSuggestionUseCase, 'reject'],
  ] as const)('registra decisão %s somente após a transição persistida', async (decision, UseCase, repositoryMethod) => {
    const result = await new UseCase(repository, stocks, auditLogRepository, telemetry, logger)
      .execute({ suggestionId: suggestion.id, userId: 'user-1' });
    expect(repository[repositoryMethod]).toHaveBeenCalledOnce();
    expect(telemetry.recordSuggestion).toHaveBeenCalledWith({ decision, confidence: 0.88 });
    expect(result.status).toBe(decision === 'confirmed' ? 'CONFIRMED' : 'REJECTED');
  });

  it('não registra decisão falha nem deixa falha da telemetria desfazer confirmação', async () => {
    repository.confirm.mockRejectedValueOnce(new Error('transition failed'));
    await expect(new ConfirmProductSuggestionUseCase(repository, stocks, auditLogRepository, telemetry, logger)
      .execute({ suggestionId: suggestion.id, userId: 'user-1' })).rejects.toThrow('transition failed');
    expect(telemetry.recordSuggestion).not.toHaveBeenCalled();

    repository.confirm.mockResolvedValueOnce({ suggestion: { ...suggestion, status: 'CONFIRMED' }, ...decidedProduct });
    telemetry.recordSuggestion.mockImplementationOnce(() => { throw new Error('telemetry unavailable'); });
    await expect(new ConfirmProductSuggestionUseCase(repository, stocks, auditLogRepository, telemetry, logger)
      .execute({ suggestionId: suggestion.id, userId: 'user-1' })).resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(logger.warn).toHaveBeenCalledWith('AI telemetry recording failed', expect.objectContaining({
      event: 'ai_suggestion', decision: 'confirmed', error: { name: 'Error' },
    }));
  });
});
