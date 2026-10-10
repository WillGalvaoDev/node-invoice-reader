import { beforeEach, describe, expect, it, vi } from 'vitest';
const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = { generateContent };
    },
    Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN' },
}));
vi.mock('../../config/env.js', () => ({
    env: { GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: 1_000, GEMINI_MAX_ATTEMPTS: 2, SIMILARITY_CONFIDENCE_THRESHOLD: 0.7 },
}));
const { ReadInvoiceUseCase } = await import('./read-invoice.use-case.js');
const { GeminiAiProvider } = await import('../../providers/gemini-ai.provider.js');
// P0-02: indisponibilidade do matching não pode virar "produto novo".
describe('ReadInvoiceUseCase · similaridade indisponível (P0-02)', () => {
    const storage = { readFile: vi.fn(), deleteFile: vi.fn() };
    const products = {
        save: vi.fn(), findByCode: vi.fn(), findByUserId: vi.fn(), findByStockId: vi.fn(),
        findById: vi.fn(), update: vi.fn(), delete: vi.fn(), findPageByStockId: vi.fn(),
    };
    const audit = { create: vi.fn(), findByCompanyId: vi.fn(), findByUserId: vi.fn() };
    const stocks = { create: vi.fn(), findById: vi.fn(), findByIdForUser: vi.fn(), findByIdForViewer: vi.fn(), findByCompanyId: vi.fn() };
    const persistence = { persist: vi.fn() };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const telemetry = { recordCall: vi.fn(), recordSuggestion: vi.fn() };
    const accessKey = '3'.repeat(44);
    const invoice = {
        accessKey, invoiceNumber: '1', series: '1', issuedAt: new Date('2026-01-01'), totalValue: 2,
        supplier: { cnpj: '11222333000181', name: 'Fornecedor' },
        products: [
            { code: 'NOVO-1', description: 'Item novo um', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1 },
            { code: 'NOVO-2', description: 'Item novo dois', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1 },
        ],
    };
    const existingCandidate = {
        id: 'candidate-1', code: 'CAND', description: 'Item novo similar', quantity: 1,
        unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-1',
    };
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        generateContent.mockReset();
        storage.readFile.mockResolvedValue(Buffer.from('documento'));
        storage.deleteFile.mockResolvedValue(undefined);
        stocks.findByIdForUser.mockResolvedValue({ id: 'stock-1', companyId: 'company-1', name: 'Estoque' });
        products.findByStockId.mockResolvedValue([existingCandidate]);
        products.findByCode.mockResolvedValue(null);
        persistence.persist.mockImplementation(async ({ operations }) => operations.map(({ product }) => product));
        audit.create.mockResolvedValue({ id: 'log-1' });
    });
    function makeSut(ai) {
        return new ReadInvoiceUseCase(storage, ai, products, audit, stocks, persistence, logger, telemetry);
    }
    function unavailableAi(reason = 'provider_error') {
        return {
            extractDanfeData: vi.fn().mockResolvedValue(invoice),
            findSimilarProduct: vi.fn().mockResolvedValue({ kind: 'unavailable', reason }),
        };
    }
    const request = { filePath: '/tmp/nota', mimeType: 'application/pdf', stockId: 'stock-1', userId: 'owner-1' };
    it('aborta a nota com erro de indisponibilidade em vez de cadastrar produto', async () => {
        await expect(makeSut(unavailableAi()).execute(request)).rejects.toMatchObject({ statusCode: 503 });
    });
    it('recusa de cota no segundo item explica aborto integral, limpa arquivo e permite reenvio', async () => {
        const ai = unavailableAi('provider_rate_limit');
        ai.findSimilarProduct.mockResolvedValueOnce({ kind: 'no_match' });
        await expect(makeSut(ai).execute(request)).rejects.toMatchObject({
            statusCode: 503,
            message: 'O serviço de IA atingiu um limite temporário. Nenhuma alteração desta nota foi aplicada ao estoque. Tente novamente mais tarde.',
        });
        expect(persistence.persist).not.toHaveBeenCalled();
        expect(audit.create).not.toHaveBeenCalled();
        expect(storage.deleteFile).toHaveBeenCalledWith(request.filePath);
        ai.findSimilarProduct.mockResolvedValue({ kind: 'no_match' });
        await expect(makeSut(ai).execute(request)).resolves.toMatchObject({ suggestions: [] });
        expect(persistence.persist).toHaveBeenCalledOnce();
    });
    it('não persiste nada: nenhum produto, nenhuma sugestão, nenhuma ProcessedInvoice', async () => {
        await expect(makeSut(unavailableAi()).execute(request)).rejects.toThrow();
        expect(persistence.persist).not.toHaveBeenCalled();
        expect(products.save).not.toHaveBeenCalled();
        expect(products.update).not.toHaveBeenCalled();
    });
    it('não grava auditoria de criação quando a nota é abortada', async () => {
        await expect(makeSut(unavailableAi()).execute(request)).rejects.toThrow();
        expect(audit.create).not.toHaveBeenCalled();
    });
    it('aborta já no primeiro item, sem consultar o provedor para os itens seguintes', async () => {
        const ai = unavailableAi();
        await expect(makeSut(ai).execute(request)).rejects.toThrow();
        expect(ai.findSimilarProduct).toHaveBeenCalledOnce();
    });
    it('aborta mesmo depois de itens anteriores já terem sido processados em memória', async () => {
        const ai = {
            extractDanfeData: vi.fn().mockResolvedValue(invoice),
            findSimilarProduct: vi.fn()
                .mockResolvedValueOnce({ kind: 'no_match' })
                .mockResolvedValueOnce({ kind: 'unavailable', reason: 'timeout' }),
        };
        await expect(makeSut(ai).execute(request)).rejects.toMatchObject({ statusCode: 503 });
        expect(ai.findSimilarProduct).toHaveBeenCalledTimes(2);
        expect(persistence.persist).not.toHaveBeenCalled();
    });
    it('remove o arquivo temporário mesmo no caminho de aborto', async () => {
        await expect(makeSut(unavailableAi()).execute(request)).rejects.toThrow();
        expect(storage.deleteFile).toHaveBeenCalledWith('/tmp/nota');
    });
    it('distingue indisponibilidade do matching de documento inválido', async () => {
        const unavailable = await makeSut(unavailableAi()).execute(request).catch((error) => error);
        const invalidDocumentAi = {
            extractDanfeData: vi.fn().mockResolvedValue({ ...invoice, accessKey: '123' }),
            findSimilarProduct: vi.fn().mockResolvedValue({ kind: 'no_match' }),
        };
        const invalidDocument = await makeSut(invalidDocumentAi).execute(request).catch((error) => error);
        expect(unavailable.statusCode).toBe(503);
        expect(invalidDocument.statusCode).toBe(422);
        expect(unavailable.message).not.toBe(invalidDocument.message);
    });
    it('não expõe detalhe do provedor nem stack trace na mensagem', async () => {
        const error = await makeSut(unavailableAi()).execute(request).catch((caught) => caught);
        expect(error.message).not.toMatch(/provider_error|gemini|stack|at /i);
        expect(error.message.length).toBeLessThan(200);
    });
    it('permite reenviar a mesma accessKey depois que o provedor volta', async () => {
        await expect(makeSut(unavailableAi()).execute(request)).rejects.toThrow();
        expect(persistence.persist).not.toHaveBeenCalled();
        const recoveredAi = {
            extractDanfeData: vi.fn().mockResolvedValue(invoice),
            findSimilarProduct: vi.fn().mockResolvedValue({ kind: 'no_match' }),
        };
        const result = await makeSut(recoveredAi).execute(request);
        expect(result.processedProducts).toHaveLength(2);
        expect(persistence.persist).toHaveBeenCalledOnce();
        expect(persistence.persist.mock.calls[0]?.[0].accessKey).toBe(accessKey);
    });
    it('não regride o fluxo legítimo de no_match: produto novo continua sendo cadastrado', async () => {
        const ai = {
            extractDanfeData: vi.fn().mockResolvedValue(invoice),
            findSimilarProduct: vi.fn().mockResolvedValue({ kind: 'no_match' }),
        };
        const result = await makeSut(ai).execute(request);
        expect(result.processedProducts).toHaveLength(2);
        expect(result.suggestions).toHaveLength(0);
    });
    it('não regride o fluxo de sugestão: match continua virando sugestão pendente', async () => {
        const ai = {
            extractDanfeData: vi.fn().mockResolvedValue(invoice),
            findSimilarProduct: vi.fn()
                .mockResolvedValueOnce({ kind: 'match', product: existingCandidate, confidence: 0.9, reason: 'equivalente' })
                .mockResolvedValueOnce({ kind: 'no_match' }),
        };
        const result = await makeSut(ai).execute(request);
        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0]).toMatchObject({ status: 'PENDING', confidence: 0.9 });
        expect(persistence.persist.mock.calls[0]?.[0].operations).toHaveLength(1);
    });
    // O defeito de origem, reproduzido de ponta a ponta com o provider real:
    // uma falha de transporte do Gemini criava produto no catálogo do cliente.
    describe('reprodução com o GeminiAiProvider real', () => {
        it('falha de transporte do Gemini não cadastra produto nem persiste a nota', async () => {
            vi.useFakeTimers();
            const ai = new GeminiAiProvider({ telemetry, logger });
            vi.spyOn(ai, 'extractDanfeData').mockResolvedValue(invoice);
            generateContent.mockRejectedValue({ status: 503, message: 'upstream indisponivel' });
            const pending = makeSut(ai).execute(request);
            const assertion = expect(pending).rejects.toMatchObject({ statusCode: 503 });
            await vi.runAllTimersAsync();
            await assertion;
            expect(persistence.persist).not.toHaveBeenCalled();
            expect(products.save).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=read-invoice.similarity-unavailable.spec.js.map