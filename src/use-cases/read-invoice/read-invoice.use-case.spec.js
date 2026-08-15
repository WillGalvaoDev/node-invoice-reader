import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadInvoiceUseCase } from './read-invoice.use-case.js';
describe('ReadInvoiceUseCase', () => {
    let storageProviderMock;
    let aiProviderMock;
    let productRepositoryMock;
    let auditLogRepositoryMock;
    let stockRepositoryMock;
    let invoicePersistenceMock;
    let loggerMock;
    let telemetryMock;
    let sut;
    const mockAiResult = {
        accessKey: '35260700000000000000550010000000011000000001',
        invoiceNumber: '000542',
        series: '2',
        issuedAt: new Date('2026-07-02'),
        totalValue: 350.00,
        supplier: {
            cnpj: '11222333000181',
            name: 'METALURGICA DO MEIER LTDA',
            stateRegistration: '987654321'
        },
        products: [
            {
                code: '0982',
                description: 'PARAF SEXTAVADO 1/4 X 2',
                quantity: 50,
                unitMeasurement: 'UN',
                unitPrice: 2.50,
                totalPrice: 125.00
            },
            {
                code: '1045',
                description: 'CHAVE PHILIPS ACCO PRO',
                quantity: 5,
                unitMeasurement: 'CX',
                unitPrice: 45.00,
                totalPrice: 225.00
            }
        ]
    };
    beforeEach(() => {
        storageProviderMock = {
            readFile: vi.fn().mockResolvedValue(Buffer.from('mock-file-content')),
            deleteFile: vi.fn().mockResolvedValue(undefined)
        };
        aiProviderMock = {
            extractDanfeData: vi.fn().mockResolvedValue(mockAiResult),
            findSimilarProduct: vi.fn().mockResolvedValue({ kind: 'no_match' })
        };
        productRepositoryMock = {
            save: vi.fn().mockImplementation((product) => Promise.resolve({ id: 'new-id', ...product })),
            findByCode: vi.fn().mockResolvedValue(null),
            findByUserId: vi.fn().mockResolvedValue([]),
            findByStockId: vi.fn().mockResolvedValue([]),
            findById: vi.fn().mockResolvedValue(null),
            update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
            delete: vi.fn().mockResolvedValue(undefined)
        };
        stockRepositoryMock = {
            findByIdForUser: vi.fn().mockResolvedValue({
                id: 'stock-1',
                name: 'Estoque Principal',
                companyId: 'company-1',
            }),
            findById: vi.fn().mockResolvedValue({
                id: 'stock-1',
                name: 'Estoque Principal',
                companyId: 'company-1',
            }),
            findByCompanyId: vi.fn().mockResolvedValue([]),
            create: vi.fn()
        };
        auditLogRepositoryMock = {
            create: vi.fn().mockResolvedValue({ id: 'log-1', action: 'CREATE', entity: 'INVOICE' }),
            findByCompanyId: vi.fn().mockResolvedValue([]),
            findByUserId: vi.fn().mockResolvedValue([])
        };
        invoicePersistenceMock = {
            persist: vi.fn().mockImplementation(async ({ operations }) => operations.map(({ product }, index) => ({ id: `persisted-${index + 1}`, ...product }))),
        };
        loggerMock = {
            debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
        };
        telemetryMock = { recordCall: vi.fn(), recordSuggestion: vi.fn() };
        sut = new ReadInvoiceUseCase(storageProviderMock, aiProviderMock, productRepositoryMock, auditLogRepositoryMock, stockRepositoryMock, invoicePersistenceMock, loggerMock, telemetryMock);
    });
    it('deve cadastrar novos produtos no estoque quando não existirem nem por código nem por similaridade', async () => {
        const filePath = '/path/to/any/nota.png';
        const userId = 'user-any-id';
        const stockId = 'stock-1';
        const result = await sut.execute({ filePath, mimeType: 'image/jpeg', stockId, userId });
        expect(storageProviderMock.readFile).toHaveBeenCalledWith(filePath);
        expect(aiProviderMock.extractDanfeData).toHaveBeenCalledWith(Buffer.from('mock-file-content'), 'image/jpeg');
        expect(invoicePersistenceMock.persist).toHaveBeenCalledOnce();
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].operations[0]).toEqual({
            product: expect.objectContaining({ ...mockAiResult.products[0], stockId, userId })
        });
        expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE',
            entity: 'INVOICE',
            userId,
            companyId: 'company-1',
            stockId,
            description: 'Invoice processada com sucesso.',
            newState: { processedProductCount: 2, pendingSuggestionCount: 0 },
        }));
        expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE', entity: 'PRODUCT', stockId, companyId: 'company-1', userId,
            description: 'Entrada de estoque processada por invoice.', previousState: null,
            newState: expect.objectContaining({ quantity: 50, unitPrice: 2.5, totalPrice: 125 }),
        }));
        expect(result.extractedData.invoiceNumber).toBe('000542');
        expect(result.processedProducts).toHaveLength(2);
        expect(result.suggestions).toHaveLength(0);
        expect(storageProviderMock.deleteFile).toHaveBeenCalledWith(filePath);
    });
    it('deve realizar upsert (soma de quantidade) quando o produto já existir pelo código no estoque', async () => {
        const existingProduct = {
            id: 'existing-id-1',
            code: '0982',
            description: 'PARAF SEXTAVADO 1/4 X 2',
            quantity: 10,
            unitMeasurement: 'UN',
            unitPrice: 2.00,
            totalPrice: 20.00,
            stockId: 'stock-1',
            userId: 'user-any-id'
        };
        productRepositoryMock.findByCode.mockImplementation((code) => {
            if (code === '0982')
                return Promise.resolve(existingProduct);
            return Promise.resolve(null);
        });
        const result = await sut.execute({ filePath: '/path/nota.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-any-id' });
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].operations[0]).toEqual({
            product: expect.objectContaining({ code: '0982', quantity: 50 })
        });
        expect(productRepositoryMock.update).not.toHaveBeenCalled();
        expect(aiProviderMock.findSimilarProduct).not.toHaveBeenCalled();
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].suggestions).toEqual([]);
        expect(result.processedProducts).toHaveLength(2);
        expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE', entity: 'PRODUCT', entityId: 'existing-id-1', stockId: 'stock-1',
            previousState: { quantity: 10, unitPrice: 2, totalPrice: 20 },
            newState: expect.objectContaining({ quantity: 50 }),
        }));
    });
    it('canonicaliza o CNPJ extraído e rejeita DV inválido antes de matching/persistência', async () => {
        aiProviderMock.extractDanfeData.mockResolvedValueOnce({
            ...mockAiResult,
            supplier: { ...mockAiResult.supplier, cnpj: '12.abc.345/01de-35' },
        });
        const valid = await sut.execute({ filePath: '/path/valid.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-1' });
        expect(valid.extractedData.supplier.cnpj).toBe('12ABC34501DE35');
        const similarityCallsBeforeInvalidDanfe = aiProviderMock.findSimilarProduct.mock.calls.length;
        aiProviderMock.extractDanfeData.mockResolvedValueOnce({
            ...mockAiResult,
            supplier: { ...mockAiResult.supplier, cnpj: '12.ABC.345/01DE-34' },
        });
        await expect(sut.execute({ filePath: '/path/invalid.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-1' }))
            .rejects.toMatchObject({ statusCode: 422 });
        expect(invoicePersistenceMock.persist).toHaveBeenCalledTimes(1);
        expect(aiProviderMock.findSimilarProduct).toHaveBeenCalledTimes(similarityCallsBeforeInvalidDanfe);
    });
    it('limita e ordena candidatos do estoque antes de chamar similarity em catálogo grande', async () => {
        aiProviderMock.extractDanfeData.mockResolvedValueOnce({
            ...mockAiResult,
            products: [{
                    code: 'NEW-10', description: 'PARAFUSO SEXTAVADO 10MM', quantity: 1,
                    unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1,
                }],
        });
        const catalog = Array.from({ length: 30 }, (_, index) => ({
            id: `product-${String(index).padStart(2, '0')}`,
            code: `CODE-${index}`,
            description: index === 23 ? 'Parafuso, sextavado 10mm' : index === 22 ? 'Parafuso sextavado 20mm' : `Item irrelevante ${index}`,
            quantity: 100,
            unitMeasurement: 'UN', unitPrice: 999, totalPrice: 999,
            stockId: index === 29 ? 'other-stock' : 'stock-1',
        }));
        productRepositoryMock.findByStockId.mockResolvedValueOnce(catalog);
        await sut.execute({ filePath: '/path/large.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'owner-1' });
        const candidates = aiProviderMock.findSimilarProduct.mock.calls[0]?.[1] ?? [];
        expect(candidates.length).toBeLessThan(catalog.length);
        expect(candidates.length).toBeLessThanOrEqual(15);
        expect(candidates[0]?.id).toBe('product-23');
        expect(candidates.every((candidate) => candidate.stockId === 'stock-1')).toBe(true);
    });
    it('não chama similarity quando catálogo grande não possui candidato lexical plausível', async () => {
        aiProviderMock.extractDanfeData.mockResolvedValueOnce({
            ...mockAiResult,
            products: [{
                    code: 'NEW', description: 'COMPRESSOR INDUSTRIAL', quantity: 1,
                    unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1,
                }],
        });
        productRepositoryMock.findByStockId.mockResolvedValueOnce(Array.from({ length: 20 }, (_, index) => ({
            id: `food-${index}`, code: `FOOD-${index}`, description: `ARROZ TIPO ${index}`,
            quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: 'stock-1',
        })));
        await sut.execute({ filePath: '/path/no-match.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'owner-1' });
        expect(aiProviderMock.findSimilarProduct).not.toHaveBeenCalled();
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].operations).toHaveLength(1);
    });
    it('deve gerar uma sugestão de vínculo quando a IA encontrar um produto similar no estoque', async () => {
        const similarProduct = {
            id: 'similar-id',
            code: 'PAR-001',
            description: 'PARAFUSO SEXTAVADO 1/4 INCH',
            quantity: 100,
            unitMeasurement: 'UN',
            unitPrice: 2.10,
            totalPrice: 210.00,
            stockId: 'stock-1',
            userId: 'user-any-id'
        };
        productRepositoryMock.findByStockId.mockResolvedValue([similarProduct]);
        aiProviderMock.findSimilarProduct.mockImplementation((desc) => {
            if (desc.includes('PARAF')) {
                return Promise.resolve({
                    kind: 'match',
                    product: similarProduct,
                    confidence: 0.88,
                    reason: 'Descrição equivalente para parafuso'
                });
            }
            return Promise.resolve({ kind: 'no_match' });
        });
        const result = await sut.execute({ filePath: '/path/nota.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-any-id' });
        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0]).toMatchObject({ id: expect.any(String), status: 'PENDING' });
        expect(result.suggestions[0]?.suggestedProduct.id).toBe('similar-id');
        expect(result.suggestions[0]?.confidence).toBe(0.88);
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].operations).toHaveLength(1);
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].suggestions).toEqual([
            expect.objectContaining({
                id: result.suggestions[0]?.id,
                itemIndex: 0,
                suggestedProductId: 'similar-id',
                receivedQuantity: 50,
                receivedUnitPrice: 2.5,
                confidence: 0.88,
            }),
        ]);
        expect(telemetryMock.recordSuggestion).toHaveBeenCalledWith({ decision: 'created', confidence: 0.88 });
    });
    it('mantém invoice commitada quando telemetria da suggestion falha', async () => {
        const similarProduct = {
            id: 'similar-id', code: 'PAR-001', description: 'PARAFUSO SEXTAVADO', quantity: 10,
            unitMeasurement: 'UN', unitPrice: 2, totalPrice: 20, stockId: 'stock-1', userId: 'user-1',
        };
        productRepositoryMock.findByStockId.mockResolvedValue([similarProduct]);
        aiProviderMock.findSimilarProduct.mockResolvedValue({ kind: 'match', product: similarProduct, confidence: 0.88, reason: 'similar' });
        telemetryMock.recordSuggestion.mockImplementationOnce(() => { throw new Error('telemetry unavailable'); });
        const result = await sut.execute({ filePath: '/path/nota.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-1' });
        expect(result.suggestions).toEqual(expect.arrayContaining([expect.objectContaining({ confidence: 0.88 })]));
        expect(invoicePersistenceMock.persist).toHaveBeenCalledOnce();
        expect(loggerMock.warn).toHaveBeenCalledWith('AI telemetry recording failed', expect.objectContaining({
            event: 'ai_suggestion', decision: 'created', error: { name: 'Error' },
        }));
    });
    it('deve lançar AppError e deletar o arquivo temporário quando a IA retornar uma estrutura inválida ou sem produtos', async () => {
        const invalidAiResult = {
            ...mockAiResult,
            products: []
        };
        aiProviderMock.extractDanfeData.mockResolvedValueOnce(invalidAiResult);
        await expect(sut.execute({ filePath: '/path/nota.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-any-id' })).rejects.toThrow('Falha ao extrair produtos do DANFE. Nenhum item válido encontrado.');
        expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/nota.png');
        expect(productRepositoryMock.save).not.toHaveBeenCalled();
    });
    it('deve rejeitar produtos com valores ou quantidades negativas/zeradas retornadas pela IA', async () => {
        const maliciousAiResult = {
            ...mockAiResult,
            products: [
                {
                    code: 'MAL-01',
                    description: 'PRODUTO COM QUANTIDADE NEGATIVA',
                    quantity: -10,
                    unitMeasurement: 'UN',
                    unitPrice: 5.00,
                    totalPrice: -50.00
                }
            ]
        };
        aiProviderMock.extractDanfeData.mockResolvedValueOnce(maliciousAiResult);
        await expect(sut.execute({ filePath: '/path/nota.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-any-id' })).rejects.toThrow('Os produtos do DANFE contêm valores ou quantidades inválidas.');
        expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/nota.png');
        expect(productRepositoryMock.save).not.toHaveBeenCalled();
    });
    it('deve sanitizar a descrição dos produtos removendo scripts ou códigos nocivos retornados pela IA', async () => {
        const promptInjectionAiResult = {
            ...mockAiResult,
            products: [
                {
                    code: 'SEC-01',
                    description: '<script>alert("xss")</script> PARAFUSO AÇO INOX -- IGNORE REST',
                    quantity: 10,
                    unitMeasurement: 'UN',
                    unitPrice: 3.00,
                    totalPrice: 30.00
                }
            ]
        };
        aiProviderMock.extractDanfeData.mockResolvedValueOnce(promptInjectionAiResult);
        await sut.execute({ filePath: '/path/nota.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-any-id' });
        expect(invoicePersistenceMock.persist.mock.calls[0]?.[0].operations[0]).toEqual({
            product: expect.objectContaining({ description: 'PARAFUSO AÇO INOX -- IGNORE REST' })
        });
    });
    it('deve lançar AppError, registrar log de auditoria de falha e deletar o arquivo temporário quando o estoque informado não existir ou não for encontrado', async () => {
        stockRepositoryMock.findByIdForUser.mockResolvedValueOnce(null);
        stockRepositoryMock.findById.mockResolvedValueOnce(null);
        await expect(sut.execute({
            filePath: '/path/nota.png',
            mimeType: 'image/png',
            stockId: 'unauthorized-stock-id',
            userId: 'user-any-id',
        })).rejects.toThrow('Acesso não autorizado ao estoque informado.');
        // 🎯 Teste exige a ação precisa de segurança
        expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UNAUTHORIZED_ACCESS',
            entity: 'INVOICE',
            userId: 'user-any-id',
            description: 'Tentativa de acesso não autorizado ao estoque.',
        }));
        expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/nota.png');
        expect(aiProviderMock.extractDanfeData).not.toHaveBeenCalled();
        expect(productRepositoryMock.save).not.toHaveBeenCalled();
    });
    it('inclui produto novo anterior da mesma nota na comparação e persiste itens distintos', async () => {
        const baseItem = mockAiResult.products[0];
        const twoItems = {
            ...mockAiResult,
            products: [
                { ...baseItem, code: 'FIRST', description: 'PARAFUSO NOVO' },
                { ...baseItem, code: 'SECOND', description: 'PARAFUSO NOVO SIMILAR' },
            ],
        };
        aiProviderMock.extractDanfeData.mockResolvedValueOnce(twoItems);
        aiProviderMock.findSimilarProduct.mockImplementationOnce(async (_description, candidates) => ({
            kind: 'match', product: candidates[0], confidence: 0.9, reason: 'mesmo produto',
        }));
        await sut.execute({ filePath: '/path/two-items.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'user-any-id' });
        const persistedPlan = invoicePersistenceMock.persist.mock.calls[0][0];
        expect(persistedPlan.operations).toHaveLength(1);
        expect(aiProviderMock.findSimilarProduct.mock.calls[0]?.[1]).toEqual([
            expect.objectContaining({ id: expect.any(String), code: 'FIRST' }),
        ]);
        expect(persistedPlan.suggestions).toEqual([
            expect.objectContaining({ itemIndex: 1, suggestedProductId: persistedPlan.operations[0].product.id }),
        ]);
    });
    it('permite que o owner processe DANFE no estoque da própria empresa', async () => {
        await sut.execute({ filePath: '/path/owner.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'owner-1' });
        expect(stockRepositoryMock.findByIdForUser).toHaveBeenCalledWith('stock-1', 'owner-1');
        expect(storageProviderMock.readFile).toHaveBeenCalledWith('/path/owner.png');
        expect(aiProviderMock.extractDanfeData).toHaveBeenCalledWith(Buffer.from('mock-file-content'), 'image/png');
        expect(invoicePersistenceMock.persist).toHaveBeenCalledOnce();
    });
    it('permite que collaborator com canCreate processe entrada', async () => {
        await sut.execute({ filePath: '/path/collaborator.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'collaborator-1' });
        expect(stockRepositoryMock.findByIdForUser).toHaveBeenCalledWith('stock-1', 'collaborator-1');
        expect(aiProviderMock.extractDanfeData).toHaveBeenCalled();
        expect(invoicePersistenceMock.persist).toHaveBeenCalledOnce();
    });
    it('deriva companyId do estoque autorizado e trata falha do audit de sucesso como best-effort', async () => {
        auditLogRepositoryMock.create.mockRejectedValueOnce(new Error('audit database unavailable'));
        await expect(sut.execute({
            filePath: '/path/success.png',
            mimeType: 'image/png',
            stockId: 'stock-1',
            userId: 'owner-1',
            requestId: 'request-safe-id',
        })).resolves.toMatchObject({ processedProducts: expect.any(Array) });
        expect(invoicePersistenceMock.persist).toHaveBeenCalledOnce();
        expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE',
            entity: 'INVOICE',
            companyId: 'company-1',
        }));
        expect(loggerMock.error).toHaveBeenCalledWith('Failed to persist audit log', {
            requestId: 'request-safe-id',
            action: 'CREATE',
            entity: 'INVOICE',
            error: { name: 'Error' },
        });
        expect(JSON.stringify(loggerMock.error.mock.calls)).not.toContain('audit database unavailable');
        expect(JSON.stringify(loggerMock.error.mock.calls)).not.toContain(mockAiResult.invoiceNumber);
    });
    it('mantém 403 e bloqueia Gemini quando o audit de acesso negado falha', async () => {
        stockRepositoryMock.findByIdForUser.mockResolvedValueOnce(null);
        auditLogRepositoryMock.create.mockRejectedValueOnce(new Error('audit unavailable'));
        await expect(sut.execute({
            filePath: '/path/denied.png',
            mimeType: 'image/png',
            stockId: 'stock-from-another-company',
            userId: 'outsider-1',
            requestId: 'denied-request',
        })).rejects.toMatchObject({ statusCode: 403 });
        expect(aiProviderMock.extractDanfeData).not.toHaveBeenCalled();
        expect(invoicePersistenceMock.persist).not.toHaveBeenCalled();
        expect(loggerMock.error).toHaveBeenCalledWith('Failed to persist audit log', expect.objectContaining({
            requestId: 'denied-request', action: 'UNAUTHORIZED_ACCESS', error: { name: 'Error' },
        }));
    });
    it.each([
        ['usuário sem vínculo de outra empresa', 'outsider-1'],
        ['collaborator sem canCreate', 'collaborator-without-create'],
    ])('nega %s antes do Gemini e de qualquer escrita', async (_scenario, userId) => {
        stockRepositoryMock.findByIdForUser.mockResolvedValueOnce(null);
        stockRepositoryMock.findById.mockResolvedValueOnce({
            id: 'stock-from-another-company', name: 'Outro estoque', companyId: 'company-1',
        });
        await expect(sut.execute({
            filePath: '/path/denied.png',
            mimeType: 'image/png',
            stockId: 'stock-from-another-company',
            userId,
        })).rejects.toMatchObject({ statusCode: 403 });
        expect(auditLogRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UNAUTHORIZED_ACCESS',
            entity: 'INVOICE',
            userId,
            stockId: 'stock-from-another-company',
            companyId: 'company-1',
            description: 'Tentativa de acesso não autorizado ao estoque.',
        }));
        expect(aiProviderMock.extractDanfeData).not.toHaveBeenCalled();
        expect(aiProviderMock.findSimilarProduct).not.toHaveBeenCalled();
        expect(productRepositoryMock.findByStockId).not.toHaveBeenCalled();
        expect(productRepositoryMock.findByCode).not.toHaveBeenCalled();
        expect(productRepositoryMock.save).not.toHaveBeenCalled();
        expect(productRepositoryMock.update).not.toHaveBeenCalled();
        expect(invoicePersistenceMock.persist).not.toHaveBeenCalled();
    });
    it('rejeita DANFE incoerente antes de exact match, similarity e persistência', async () => {
        aiProviderMock.extractDanfeData.mockResolvedValueOnce({
            ...mockAiResult,
            totalValue: 10,
            products: [{ ...mockAiResult.products[0], quantity: 2, unitPrice: 10, totalPrice: 200 }],
        });
        await expect(sut.execute({ filePath: '/path/incoherent.png', mimeType: 'image/png', stockId: 'stock-1', userId: 'owner-1' }))
            .rejects.toMatchObject({ statusCode: 422, message: 'Os valores extraídos do DANFE são inconsistentes.' });
        expect(productRepositoryMock.findByStockId).not.toHaveBeenCalled();
        expect(productRepositoryMock.findByCode).not.toHaveBeenCalled();
        expect(aiProviderMock.findSimilarProduct).not.toHaveBeenCalled();
        expect(invoicePersistenceMock.persist).not.toHaveBeenCalled();
        expect(auditLogRepositoryMock.create).not.toHaveBeenCalled();
        expect(storageProviderMock.deleteFile).toHaveBeenCalledWith('/path/incoherent.png');
    });
});
//# sourceMappingURL=read-invoice.use-case.spec.js.map