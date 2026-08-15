import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { PrismaInvoicePersistenceRepository } from '../../src/repositories/prisma-invoice-persistence.repository.js';
import { PrismaProductRepository } from '../../src/repositories/prisma-product.repository.js';
import { PrismaStockRepository } from '../../src/repositories/prisma-stock.repository.js';
import { PrismaAuditLogRepository } from '../../src/repositories/prisma-audit-log.repository.js';
import { ReadInvoiceUseCase } from '../../src/use-cases/read-invoice/read-invoice.use-case.js';
import { AppError } from '../../src/errors/app-error.js';
import { PrismaProductSuggestionRepository } from '../../src/repositories/prisma-product-suggestion.repository.js';
import { PrismaCompanyRepository } from '../../src/repositories/prisma-company.repository.js';
import { ConfirmProductSuggestionUseCase } from '../../src/use-cases/product-suggestions/confirm-product-suggestion.use-case.js';
import { RejectProductSuggestionUseCase } from '../../src/use-cases/product-suggestions/reject-product-suggestion.use-case.js';
import { ListProductsUseCase } from '../../src/use-cases/list-products/list-products.use-case.js';
import express from 'express';
import { createApp } from '../../src/app.js';
import { checkDatabaseHealth } from '../../src/infra/health.js';
const persistence = new PrismaInvoicePersistenceRepository();
const suggestionRepository = new PrismaProductSuggestionRepository();
const productRepository = new PrismaProductRepository();
async function cleanDatabase() {
    await prisma.auditLog.deleteMany();
    await prisma.productSimilaritySuggestion.deleteMany();
    await prisma.processedInvoice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.stockPermission.deleteMany();
    await prisma.companyCollaborator.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
}
async function seedPendingSuggestion(stockId, suggestedProductId, overrides = {}) {
    const invoice = await prisma.processedInvoice.create({
        data: { accessKey: `${Math.floor(Math.random() * 9) + 1}${crypto.randomUUID().replaceAll('-', '').padEnd(43, '0').slice(0, 43)}`, stockId },
    });
    return prisma.productSimilaritySuggestion.create({
        data: {
            processedInvoiceId: invoice.id, itemIndex: 0, stockId, suggestedProductId,
            receivedCode: `NEW-${crypto.randomUUID()}`, receivedDescription: 'Produto recebido',
            receivedQuantity: 5, receivedUnitPrice: 20, unitMeasurement: 'UN',
            confidence: 0.88, reason: 'equivalente', ...overrides,
        },
    });
}
async function seedOwnerAndStock() {
    const owner = await prisma.user.create({
        data: { email: `owner-${crypto.randomUUID()}@test.local`, name: 'Owner', password: 'test-hash' },
    });
    const company = await prisma.company.create({
        data: { name: 'Empresa teste', cnpj: '11222333000181', ownerId: owner.id },
    });
    const stock = await prisma.stock.create({
        data: { name: 'Estoque teste', companyId: company.id },
    });
    return { owner, company, stock };
}
function product(stockId, code, quantity, overrides = {}) {
    return {
        code,
        description: `Produto ${code}`,
        quantity,
        unitMeasurement: 'UN',
        unitPrice: 10,
        totalPrice: 10 * quantity,
        stockId,
        ...overrides,
    };
}
function plan(stockId, accessKey, products) {
    return {
        accessKey,
        stockId,
        operations: products.map((item) => ({ product: item })),
    };
}
beforeEach(cleanDatabase);
afterAll(disconnectPrisma);
async function indexNames(tableName) {
    const rows = await prisma.$queryRaw `
    SELECT indexname FROM pg_indexes WHERE tablename = ${tableName}
  `;
    return rows.map((row) => row.indexname);
}
describe('PostgreSQL Integration Gate', () => {
    it('M5-01: índices reais de audit_logs e products existem, e o índice redundante de products foi removido', async () => {
        const productIndexes = await indexNames('products');
        expect(productIndexes).toContain('products_stockId_createdAt_id_idx');
        expect(productIndexes).not.toContain('products_stockId_idx');
        expect(productIndexes).toContain('products_stockId_code_key'); // unique (stockId, code) preservado
        const auditIndexes = await indexNames('audit_logs');
        expect(auditIndexes).toContain('audit_logs_companyId_createdAt_idx');
        expect(auditIndexes).toContain('audit_logs_userId_createdAt_idx');
    });
    it('expõe health público baseado em SELECT 1 real no PostgreSQL', async () => {
        const app = createApp({ applicationRoutes: express.Router(), healthProbe: checkDatabaseHealth });
        const server = await new Promise((resolve, reject) => {
            const candidate = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve(candidate));
        });
        try {
            const address = server.address();
            if (!address || typeof address === 'string')
                throw new Error('Endereço inválido');
            const response = await fetch(`http://127.0.0.1:${address.port}/health`);
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ status: 'ok' });
        }
        finally {
            await new Promise((resolve) => server.close(() => resolve()));
        }
    });
    it('usa identidade composta e traduz P2002/P2003 reais sem perder integridade', async () => {
        const { company, stock: stockA } = await seedOwnerAndStock();
        const stockB = await prisma.stock.create({ data: { name: 'Estoque B', companyId: company.id } });
        const productA = await productRepository.save(product(stockA.id, 'SAME-CODE', 1));
        const productB = await productRepository.save(product(stockB.id, 'SAME-CODE', 2));
        const productAId = productA.id;
        await expect(productRepository.findByCode('SAME-CODE', stockA.id)).resolves.toMatchObject({ id: productA.id, stockId: stockA.id });
        await expect(productRepository.findByCode('SAME-CODE', stockB.id)).resolves.toMatchObject({ id: productB.id, stockId: stockB.id });
        const concurrent = await Promise.allSettled([
            productRepository.save(product(stockA.id, 'CONSTRAINT-RACE', 1)),
            productRepository.save(product(stockA.id, 'CONSTRAINT-RACE', 1)),
        ]);
        const fulfilled = concurrent.filter((result) => result.status === 'fulfilled');
        const rejected = concurrent.filter((result) => result.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({ reason: { name: 'AppError', statusCode: 409, message: 'Produto já cadastrado neste estoque.' } });
        expect(await prisma.product.count({ where: { stockId: stockA.id, code: 'CONSTRAINT-RACE' } })).toBe(1);
        await seedPendingSuggestion(stockA.id, productAId);
        await expect(productRepository.delete(productAId)).rejects.toMatchObject({
            name: 'AppError', statusCode: 409,
            message: 'Produto possui referências e não pode ser removido.',
        });
        await expect(prisma.product.findUnique({ where: { id: productAId } })).resolves.not.toBeNull();
        expect(await prisma.productSimilaritySuggestion.count({ where: { suggestedProductId: productAId } })).toBe(1);
    });
    it('rejeita DANFE incoerente sem estado e permite retry coerente da mesma accessKey', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'COHERENCE', 10, { unitPrice: 5, totalPrice: 50 }) });
        const accessKey = '93000000000000000000000000000000000000000003';
        let extracted = {
            accessKey, invoiceNumber: '93', series: '1', issuedAt: new Date(), totalValue: 200,
            supplier: { cnpj: '11222333000181', name: 'Fornecedor' },
            products: [{ code: 'COHERENCE', description: 'Produto', quantity: 5, unitPrice: 20, totalPrice: 200, unitMeasurement: 'UN' }],
        };
        let similarityCalls = 0;
        const ai = {
            async extractDanfeData() { return extracted; },
            async findSimilarProduct() { similarityCalls += 1; return { kind: 'no_match' }; },
        };
        const storage = { async readFile() { return Buffer.alloc(0); }, async deleteFile() { } };
        const useCase = new ReadInvoiceUseCase(storage, ai, new PrismaProductRepository(), new PrismaAuditLogRepository(), new PrismaStockRepository(), persistence);
        await expect(useCase.execute({ filePath: 'incoherent', mimeType: 'image/png', stockId: stock.id, userId: owner.id }))
            .rejects.toMatchObject({ statusCode: 422 });
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
        expect(await prisma.productSimilaritySuggestion.count({ where: { stockId: stock.id } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);
        let persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'COHERENCE' } } });
        expect(Number(persisted.quantity)).toBe(10);
        expect(Number(persisted.unitPrice)).toBe(5);
        expect(similarityCalls).toBe(0);
        extracted = {
            ...extracted, totalValue: 100,
            products: [{ ...extracted.products[0], totalPrice: 100 }],
        };
        await expect(useCase.execute({ filePath: 'coherent-retry', mimeType: 'image/png', stockId: stock.id, userId: owner.id })).resolves.toBeDefined();
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
        persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'COHERENCE' } } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
    });
    it('lista por ownership do stock, preserva creator null e pagina sem vazamento cross-tenant', async () => {
        const { owner, company, stock } = await seedOwnerAndStock();
        const collaboratorA = await prisma.user.create({ data: { email: `viewer-a-${crypto.randomUUID()}@test.local`, name: 'Viewer A', password: 'hash' } });
        const collaboratorB = await prisma.user.create({ data: { email: `viewer-b-${crypto.randomUUID()}@test.local`, name: 'Viewer B', password: 'hash' } });
        const removedCreator = await prisma.user.create({ data: { email: `removed-${crypto.randomUUID()}@test.local`, name: 'Removed', password: 'hash' } });
        for (const user of [collaboratorA, collaboratorB]) {
            const membership = await prisma.companyCollaborator.create({ data: { companyId: company.id, userId: user.id } });
            await prisma.stockPermission.create({ data: { collaboratorId: membership.id, stockId: stock.id, canView: true } });
        }
        const creators = [owner.id, collaboratorA.id, collaboratorB.id, removedCreator.id, owner.id];
        for (let index = 0; index < creators.length; index += 1) {
            await prisma.product.create({ data: product(stock.id, `LIST-${index}`, 1, { userId: creators[index] }) });
        }
        await prisma.user.delete({ where: { id: removedCreator.id } });
        const useCase = new ListProductsUseCase(new PrismaProductRepository(), new PrismaStockRepository());
        const first = await useCase.execute({ userId: owner.id, stockId: stock.id, limit: 2 });
        const second = await useCase.execute({ userId: owner.id, stockId: stock.id, limit: 2, cursor: first.nextCursor });
        const third = await useCase.execute({ userId: owner.id, stockId: stock.id, limit: 2, cursor: second.nextCursor });
        const ownerItems = [...first.items, ...second.items, ...third.items];
        const collaboratorPage = await useCase.execute({ userId: collaboratorA.id, stockId: stock.id, limit: 50 });
        expect([first.items.length, second.items.length, third.items.length]).toEqual([2, 2, 1]);
        expect(third.nextCursor).toBeNull();
        expect(new Set(ownerItems.map((item) => item.id)).size).toBe(5);
        expect(collaboratorPage.items.map((item) => item.id)).toEqual(ownerItems.map((item) => item.id));
        expect(collaboratorPage.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ userId: collaboratorB.id }), expect.objectContaining({ userId: null }),
        ]));
        const outsider = await prisma.user.create({ data: { email: `list-outsider-${crypto.randomUUID()}@test.local`, name: 'Outsider', password: 'hash' } });
        await expect(useCase.execute({ userId: outsider.id, stockId: stock.id, limit: 50 })).rejects.toMatchObject({ statusCode: 403 });
        const otherOwner = await prisma.user.create({ data: { email: `other-owner-${crypto.randomUUID()}@test.local`, name: 'Other Owner', password: 'hash' } });
        const otherCompany = await prisma.company.create({ data: { name: 'Outra empresa', cnpj: '11444777000161', ownerId: otherOwner.id } });
        const otherStock = await prisma.stock.create({ data: { name: 'Outro estoque', companyId: otherCompany.id } });
        const otherProduct = await prisma.product.create({ data: product(otherStock.id, 'OTHER-STOCK-CURSOR', 1) });
        await expect(useCase.execute({ userId: owner.id, stockId: stock.id, limit: 2, cursor: otherProduct.id })).rejects.toMatchObject({ statusCode: 400 });
    });
    it('persiste similarity como PENDING atomica sem alterar estoque e sem duplicar no retry', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        const candidate = await prisma.product.create({ data: product(stock.id, 'CANDIDATE', 10, { unitPrice: 5, totalPrice: 50 }) });
        const accessKey = '91000000000000000000000000000000000000000001';
        const extracted = {
            accessKey, invoiceNumber: '91', series: '1', issuedAt: new Date(), totalValue: 130,
            supplier: { cnpj: '11222333000181', name: 'Fornecedor' },
            products: [
                { code: 'SUPPLIER-CODE-1', description: 'Produto candidato um', quantity: 5, unitPrice: 20, totalPrice: 100, unitMeasurement: 'UN' },
                { code: 'SUPPLIER-CODE-2', description: 'Produto candidato dois', quantity: 2, unitPrice: 15, totalPrice: 30, unitMeasurement: 'UN' },
            ],
        };
        const ai = {
            async extractDanfeData() { return extracted; },
            async findSimilarProduct() { return { kind: 'match', product: { ...product(stock.id, candidate.code, 10), id: candidate.id }, confidence: 0.88, reason: 'equivalente' }; },
        };
        const storage = { async readFile() { return Buffer.alloc(0); }, async deleteFile() { } };
        const useCase = new ReadInvoiceUseCase(storage, ai, new PrismaProductRepository(), new PrismaAuditLogRepository(), new PrismaStockRepository(), persistence);
        const result = await useCase.execute({ filePath: 'pending-file', mimeType: 'image/png', stockId: stock.id, userId: owner.id });
        expect(result.suggestions).toEqual([
            expect.objectContaining({ id: expect.any(String), status: 'PENDING' }),
            expect.objectContaining({ id: expect.any(String), status: 'PENDING' }),
        ]);
        const pending = await prisma.productSimilaritySuggestion.findMany({
            where: { processedInvoice: { accessKey } }, orderBy: { itemIndex: 'asc' },
        });
        expect(pending).toHaveLength(2);
        expect(pending[0]).toMatchObject({ itemIndex: 0, stockId: stock.id, suggestedProductId: candidate.id, status: 'PENDING' });
        expect(pending[1]).toMatchObject({ itemIndex: 1, stockId: stock.id, suggestedProductId: candidate.id, status: 'PENDING' });
        expect(Number(pending[0].receivedQuantity)).toBe(5);
        expect(Number(pending[0].receivedUnitPrice)).toBe(20);
        const unchangedCandidate = await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } });
        expect(Number(unchangedCandidate.quantity)).toBe(10);
        expect(unchangedCandidate.description).toBe('Produto CANDIDATE');
        await expect(useCase.execute({ filePath: 'pending-retry', mimeType: 'image/png', stockId: stock.id, userId: owner.id }))
            .rejects.toMatchObject({ statusCode: 409 });
        expect(await prisma.productSimilaritySuggestion.count({ where: { processedInvoice: { accessKey } } })).toBe(2);
    });
    it('confirma PENDING com weighted average e impede segunda aplicacao', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        const candidate = await prisma.product.create({ data: product(stock.id, 'CONFIRM', 10, { unitPrice: 5, totalPrice: 50 }) });
        const suggestion = await seedPendingSuggestion(stock.id, candidate.id);
        const useCase = new ConfirmProductSuggestionUseCase(suggestionRepository, new PrismaStockRepository());
        const decided = await useCase.execute({ suggestionId: suggestion.id, userId: owner.id });
        expect(decided).toMatchObject({ status: 'CONFIRMED', decidedByUserId: owner.id, decidedAt: expect.any(Date) });
        let persisted = await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
        expect(persisted.description).toBe('Produto CONFIRM');
        expect((await prisma.productSimilaritySuggestion.findUniqueOrThrow({ where: { id: suggestion.id } })).receivedDescription).toBe('Produto recebido');
        await expect(useCase.execute({ suggestionId: suggestion.id, userId: owner.id })).rejects.toMatchObject({ statusCode: 409 });
        persisted = await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
    });
    it('rejeita PENDING, preserva candidato e cadastra snapshot como novo produto', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        const candidate = await prisma.product.create({ data: product(stock.id, 'REJECT-CANDIDATE', 10, { unitPrice: 5, totalPrice: 50 }) });
        const suggestion = await seedPendingSuggestion(stock.id, candidate.id, { receivedCode: 'REJECT-NEW' });
        const decided = await new RejectProductSuggestionUseCase(suggestionRepository, new PrismaStockRepository())
            .execute({ suggestionId: suggestion.id, userId: owner.id });
        expect(decided).toMatchObject({ status: 'REJECTED', decidedByUserId: owner.id, decidedAt: expect.any(Date) });
        const unchangedCandidate = await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } });
        expect(Number(unchangedCandidate.quantity)).toBe(10);
        expect(unchangedCandidate.description).toBe('Produto REJECT-CANDIDATE');
        const created = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'REJECT-NEW' } } });
        expect(Number(created.quantity)).toBe(5);
        expect(Number(created.unitPrice)).toBe(20);
        expect(created.description).toBe('Produto recebido');
    });
    it('duas confirmacoes concorrentes produzem uma decisao e uma entrada', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        const candidate = await prisma.product.create({ data: product(stock.id, 'DOUBLE-CONFIRM', 10, { unitPrice: 5, totalPrice: 50 }) });
        const suggestion = await seedPendingSuggestion(stock.id, candidate.id);
        const results = await Promise.allSettled([
            suggestionRepository.confirm(suggestion.id, owner.id), suggestionRepository.confirm(suggestion.id, owner.id),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({ statusCode: 409 });
        expect(await prisma.productSimilaritySuggestion.findUniqueOrThrow({ where: { id: suggestion.id } })).toMatchObject({ status: 'CONFIRMED', decidedByUserId: owner.id });
        const persisted = await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
    });
    it('confirm e reject concorrentes deixam estado e estoque coerentes com um unico vencedor', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        const candidate = await prisma.product.create({ data: product(stock.id, 'DECISION-RACE', 10, { unitPrice: 5, totalPrice: 50 }) });
        const suggestion = await seedPendingSuggestion(stock.id, candidate.id, { receivedCode: 'DECISION-RACE-NEW' });
        const results = await Promise.allSettled([
            suggestionRepository.confirm(suggestion.id, owner.id), suggestionRepository.reject(suggestion.id, owner.id),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        const finalSuggestion = await prisma.productSimilaritySuggestion.findUniqueOrThrow({ where: { id: suggestion.id } });
        const finalCandidate = await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } });
        const newProduct = await prisma.product.findUnique({ where: { stockId_code: { stockId: stock.id, code: 'DECISION-RACE-NEW' } } });
        if (finalSuggestion.status === 'CONFIRMED') {
            expect(Number(finalCandidate.quantity)).toBe(15);
            expect(newProduct).toBeNull();
        }
        else {
            expect(finalSuggestion.status).toBe('REJECTED');
            expect(Number(finalCandidate.quantity)).toBe(10);
            expect(Number(newProduct?.quantity)).toBe(5);
        }
    });
    it('nega decisao cross-tenant antes da transicao', async () => {
        const { stock } = await seedOwnerAndStock();
        const outsider = await prisma.user.create({ data: { email: `decision-outsider-${crypto.randomUUID()}@test.local`, name: 'Outsider', password: 'hash' } });
        const candidate = await prisma.product.create({ data: product(stock.id, 'DENIED-SUGGESTION', 10) });
        const suggestion = await seedPendingSuggestion(stock.id, candidate.id);
        await expect(new ConfirmProductSuggestionUseCase(suggestionRepository, new PrismaStockRepository())
            .execute({ suggestionId: suggestion.id, userId: outsider.id })).rejects.toMatchObject({ statusCode: 403 });
        expect(await prisma.productSimilaritySuggestion.findUniqueOrThrow({ where: { id: suggestion.id } })).toMatchObject({ status: 'PENDING' });
        expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } })).quantity)).toBe(10);
    });
    it('permite collaborator com canCreate decidir suggestion', async () => {
        const { company, stock } = await seedOwnerAndStock();
        const collaborator = await prisma.user.create({ data: { email: `decision-collab-${crypto.randomUUID()}@test.local`, name: 'Collaborator', password: 'hash' } });
        const membership = await prisma.companyCollaborator.create({ data: { companyId: company.id, userId: collaborator.id } });
        await prisma.stockPermission.create({ data: { collaboratorId: membership.id, stockId: stock.id, canCreate: true } });
        const candidate = await prisma.product.create({ data: product(stock.id, 'COLLAB-SUGGESTION', 10, { unitPrice: 5, totalPrice: 50 }) });
        const suggestion = await seedPendingSuggestion(stock.id, candidate.id);
        await expect(new ConfirmProductSuggestionUseCase(suggestionRepository, new PrismaStockRepository())
            .execute({ suggestionId: suggestion.id, userId: collaborator.id }))
            .resolves.toMatchObject({ status: 'CONFIRMED', decidedByUserId: collaborator.id });
        expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: candidate.id } })).quantity)).toBe(15);
    });
    it('rollbacka ProcessedInvoice, entradas e suggestions quando a persistencia pending falha', async () => {
        const { stock } = await seedOwnerAndStock();
        const candidate = await prisma.product.create({ data: product(stock.id, 'ROLLBACK-SUGGESTION-CANDIDATE', 10) });
        const accessKey = '92000000000000000000000000000000000000000002';
        const suggestion = {
            id: crypto.randomUUID(), itemIndex: 0, suggestedProductId: candidate.id,
            receivedCode: 'ROLLBACK-SUGGESTION', receivedDescription: 'Produto', receivedQuantity: 2,
            receivedUnitPrice: 7, unitMeasurement: 'UN', confidence: 0.8, reason: 'similar',
        };
        await expect(persistence.persist({
            accessKey, stockId: stock.id,
            operations: [{ product: product(stock.id, 'ROLLBACK-DETERMINISTIC', 3) }],
            suggestions: [suggestion, { ...suggestion, id: crypto.randomUUID() }],
        })).rejects.toBeDefined();
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
        expect(await prisma.product.count({ where: { code: 'ROLLBACK-DETERMINISTIC' } })).toBe(0);
        expect(await prisma.productSimilaritySuggestion.count({ where: { stockId: stock.id } })).toBe(0);
        await expect(persistence.persist({
            accessKey, stockId: stock.id, operations: [], suggestions: [suggestion],
        })).resolves.toEqual([]);
        expect(await prisma.productSimilaritySuggestion.count({ where: { stockId: stock.id } })).toBe(1);
    });
    it('aplica o schema completo e executa uma operação mínima com as constraints finais', async () => {
        const { stock } = await seedOwnerAndStock();
        const accessKey = '10000000000000000000000000000000000000000001';
        await persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'ZERO-1', 2)]));
        await expect(prisma.processedInvoice.findUnique({ where: { accessKey } })).resolves.toMatchObject({ stockId: stock.id });
        await expect(prisma.product.findUnique({ where: { stockId_code: { stockId: stock.id, code: 'ZERO-1' } } })).resolves.toMatchObject({ code: 'ZERO-1' });
    });
    it('faz rollback real de identidade, primeiro item e auditoria quando item posterior falha', async () => {
        const { stock } = await seedOwnerAndStock();
        const accessKey = '20000000000000000000000000000000000000000002';
        await expect(persistence.persist(plan(stock.id, accessKey, [
            product(stock.id, 'ROLLBACK-OK', 3),
            product(stock.id, 'ROLLBACK-FAIL', 1, { unitPrice: 10_000_000_000 }),
        ]))).rejects.toBeDefined();
        expect(await prisma.product.count({ where: { stockId: stock.id } })).toBe(0);
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);
        await persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'ROLLBACK-RETRY', 4)]));
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
        expect(Number((await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'ROLLBACK-RETRY' } } })).quantity)).toBe(4);
    });
    it('preserva ambos os incrementos em transações realmente concorrentes', async () => {
        const { stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'CONCURRENT', 10) });
        await Promise.all([
            persistence.persist(plan(stock.id, '30000000000000000000000000000000000000000003', [product(stock.id, 'CONCURRENT', 7)])),
            persistence.persist(plan(stock.id, '40000000000000000000000000000000000000000004', [product(stock.id, 'CONCURRENT', 11)])),
        ]);
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'CONCURRENT' } } });
        expect(Number(persisted.quantity)).toBe(28);
        expect(await prisma.processedInvoice.count()).toBe(2);
    });
    it('calcula custo medio ponderado real e mantem total derivado no PostgreSQL', async () => {
        const { stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'WEIGHTED', 10, { unitPrice: 5, totalPrice: 50 }) });
        await prisma.product.create({ data: product(stock.id, 'WEIGHTED-EQUAL', 10, { unitPrice: 5, totalPrice: 50 }) });
        await persistence.persist(plan(stock.id, '31000000000000000000000000000000000000000003', [
            product(stock.id, 'WEIGHTED', 5, { unitPrice: 20, totalPrice: 100 }),
            product(stock.id, 'WEIGHTED-EQUAL', 10, { unitPrice: 15, totalPrice: 150 }),
        ]));
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'WEIGHTED' } } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
        expect(Number(persisted.totalPrice)).toBe(150);
        const equalWeights = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'WEIGHTED-EQUAL' } } });
        expect(Number(equalWeights.quantity)).toBe(20);
        expect(Number(equalWeights.unitPrice)).toBe(10);
        expect(Number(equalWeights.totalPrice)).toBe(200);
    });
    it('preserva description original em entradas sequenciais por exact code', async () => {
        const { stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'STABLE-DESCRIPTION', 10, { description: 'Descrição Original', unitPrice: 5, totalPrice: 50 }) });
        await persistence.persist(plan(stock.id, '31600000000000000000000000000000000000000003', [
            product(stock.id, 'STABLE-DESCRIPTION', 5, { description: 'DESCRIÇÃO OCR DIFERENTE', unitPrice: 10, totalPrice: 50 }),
        ]));
        await persistence.persist(plan(stock.id, '31700000000000000000000000000000000000000003', [
            product(stock.id, 'STABLE-DESCRIPTION', 5, { description: 'texto completamente diferente', unitPrice: 15, totalPrice: 75 }),
        ]));
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'STABLE-DESCRIPTION' } } });
        expect(persisted.description).toBe('Descrição Original');
        expect(Number(persisted.quantity)).toBe(20);
        expect(Number(persisted.unitPrice)).toBe(8.75);
        expect(Number(persisted.totalPrice)).toBe(175);
        expect((await new PrismaProductRepository().findByStockId(stock.id)).find((item) => item.code === 'STABLE-DESCRIPTION')?.description).toBe('Descrição Original');
    });
    it('trata saldo atual zero como uma entrada inicial e respeita casas decimais', async () => {
        const { stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'ZERO-COST', 0, { unitPrice: 99.99, totalPrice: 0 }) });
        await persistence.persist(plan(stock.id, '31500000000000000000000000000000000000000003', [
            product(stock.id, 'ZERO-COST', 2.5, { unitPrice: 12.34, totalPrice: 30.85 }),
        ]));
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'ZERO-COST' } } });
        expect(Number(persisted.quantity)).toBe(2.5);
        expect(Number(persisted.unitPrice)).toBe(12.34);
        expect(Number(persisted.totalPrice)).toBe(30.85);
    });
    it('serializa duas entradas concorrentes com custos diferentes sem perder valor', async () => {
        const { stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'WEIGHTED-CONCURRENT', 10, { unitPrice: 5, totalPrice: 50 }) });
        await Promise.all([
            persistence.persist(plan(stock.id, '32000000000000000000000000000000000000000003', [
                product(stock.id, 'WEIGHTED-CONCURRENT', 10, { description: 'INVOICE A', unitPrice: 10, totalPrice: 100 }),
            ])),
            persistence.persist(plan(stock.id, '33000000000000000000000000000000000000000003', [
                product(stock.id, 'WEIGHTED-CONCURRENT', 10, { description: 'INVOICE B', unitPrice: 20, totalPrice: 200 }),
            ])),
        ]);
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'WEIGHTED-CONCURRENT' } } });
        expect(Number(persisted.quantity)).toBe(30);
        expect(Number(persisted.unitPrice)).toBe(11.67);
        expect(Number(persisted.totalPrice)).toBe(350.10);
        expect(persisted.description).toBe('Produto WEIGHTED-CONCURRENT');
        expect(Number(persisted.quantity) * Number(persisted.unitPrice)).toBe(Number(persisted.totalPrice));
    });
    it('faz upsert concorrente de produto inexistente com uma identidade e custo ponderado', async () => {
        const { stock } = await seedOwnerAndStock();
        await Promise.all([
            persistence.persist(plan(stock.id, '34000000000000000000000000000000000000000003', [
                product(stock.id, 'NEW-CONCURRENT', 10, { description: 'Descrição vencedora A', unitPrice: 10, totalPrice: 100 }),
            ])),
            persistence.persist(plan(stock.id, '35000000000000000000000000000000000000000003', [
                product(stock.id, 'NEW-CONCURRENT', 5, { description: 'Descrição vencedora B', unitPrice: 20, totalPrice: 100 }),
            ])),
        ]);
        expect(await prisma.product.count({ where: { stockId: stock.id, code: 'NEW-CONCURRENT' } })).toBe(1);
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'NEW-CONCURRENT' } } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(13.33);
        expect(Number(persisted.totalPrice)).toBe(199.95);
        expect(['Descrição vencedora A', 'Descrição vencedora B']).toContain(persisted.description);
    });
    it('rollback real restaura tambem o custo anterior', async () => {
        const { stock } = await seedOwnerAndStock();
        await prisma.product.create({ data: product(stock.id, 'COST-ROLLBACK', 10, { unitPrice: 5, totalPrice: 50 }) });
        const accessKey = '36000000000000000000000000000000000000000003';
        await expect(persistence.persist(plan(stock.id, accessKey, [
            product(stock.id, 'COST-ROLLBACK', 10, { unitPrice: 15, totalPrice: 150 }),
            product(stock.id, 'COST-ROLLBACK-FAIL', 1, { unitPrice: 10_000_000_000 }),
        ]))).rejects.toBeDefined();
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'COST-ROLLBACK' } } });
        expect(Number(persisted.quantity)).toBe(10);
        expect(Number(persisted.unitPrice)).toBe(5);
        expect(Number(persisted.totalPrice)).toBe(50);
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
    });
    it('mantém idempotência concorrente, mapeia duplicata para 409 e persiste uma única entrada', async () => {
        const { stock } = await seedOwnerAndStock();
        const accessKey = '50000000000000000000000000000000000000000005';
        await prisma.product.create({ data: product(stock.id, 'IDEMPOTENT', 10, { unitPrice: 5, totalPrice: 50 }) });
        const results = await Promise.allSettled([
            persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'IDEMPOTENT', 5, { unitPrice: 20, totalPrice: 100 })])),
            persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'IDEMPOTENT', 5, { unitPrice: 20, totalPrice: 100 })])),
        ]);
        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const rejected = results.filter((result) => result.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toMatchObject({ statusCode: 409 });
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
        expect(await prisma.product.count({ where: { stockId: stock.id, code: 'IDEMPOTENT' } })).toBe(1);
        const persisted = await prisma.product.findUniqueOrThrow({ where: { stockId_code: { stockId: stock.id, code: 'IDEMPOTENT' } } });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
        expect(Number(persisted.totalPrice)).toBe(150);
        expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);
    });
    it('expõe a UNIQUE real como P2002 e mantém a tradução de domínio no fluxo normal', async () => {
        const { stock } = await seedOwnerAndStock();
        const accessKey = '60000000000000000000000000000000000000000006';
        await prisma.processedInvoice.create({ data: { accessKey, stockId: stock.id } });
        const directConflict = await prisma.processedInvoice.create({ data: { accessKey, stockId: stock.id } }).catch((error) => error);
        expect(directConflict).toMatchObject({ code: 'P2002' });
        const domainConflict = await persistence.persist(plan(stock.id, accessKey, [product(stock.id, 'UNIQUE', 1)])).catch((error) => error);
        expect(domainConflict).toBeInstanceOf(AppError);
        expect(domainConflict).toMatchObject({ statusCode: 409 });
        expect(await prisma.product.count({ where: { code: 'UNIQUE' } })).toBe(0);
    });
    it('não persiste identidade nem saldo quando autorização é negada', async () => {
        const { stock } = await seedOwnerAndStock();
        const outsider = await prisma.user.create({
            data: { email: `outsider-${crypto.randomUUID()}@test.local`, name: 'Outsider', password: 'test-hash' },
        });
        const accessKey = '70000000000000000000000000000000000000000007';
        let aiCalls = 0;
        const extracted = {
            accessKey, invoiceNumber: '7', series: '1', issuedAt: new Date(), totalValue: 5,
            supplier: { cnpj: '11222333000181', name: 'Fornecedor', stateRegistration: '1' },
            products: [{ code: 'DENIED', description: 'Negado', quantity: 1, unitPrice: 5, totalPrice: 5, unitMeasurement: 'UN' }],
        };
        const ai = {
            async extractDanfeData() { aiCalls += 1; return extracted; },
            async findSimilarProduct() { return { kind: 'no_match' }; },
        };
        const storage = { async readFile() { return Buffer.alloc(0); }, async deleteFile() { } };
        const useCase = new ReadInvoiceUseCase(storage, ai, new PrismaProductRepository(), new PrismaAuditLogRepository(), new PrismaStockRepository(), persistence);
        await expect(useCase.execute({ filePath: 'controlled-test-file', mimeType: 'image/png', stockId: stock.id, userId: outsider.id })).rejects.toMatchObject({ statusCode: 403 });
        expect(aiCalls).toBe(0);
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(0);
        expect(await prisma.product.count({ where: { stockId: stock.id } })).toBe(0);
        const deniedAudit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'UNAUTHORIZED_ACCESS', userId: outsider.id } });
        expect(deniedAudit).toMatchObject({
            companyId: stock.companyId, stockId: stock.id,
            description: 'Tentativa de acesso não autorizado ao estoque.',
        });
    });
    it('persiste audit enriquecido de invoice e estado anterior/posterior do produto após o commit', async () => {
        const { owner, company, stock } = await seedOwnerAndStock();
        const existing = await prisma.product.create({
            data: product(stock.id, 'AUDITED', 10, { unitPrice: 5, totalPrice: 50 }),
        });
        const accessKey = '75000000000000000000000000000000000000000007';
        const extracted = {
            accessKey, invoiceNumber: 'sensitive-number', series: '1', issuedAt: new Date(), totalValue: 100,
            supplier: { cnpj: '11222333000181', name: 'Fornecedor' },
            products: [{ code: 'AUDITED', description: 'Descrição não necessária', quantity: 5, unitPrice: 20, totalPrice: 100, unitMeasurement: 'UN' }],
        };
        const ai = {
            async extractDanfeData() { return extracted; }, async findSimilarProduct() { return { kind: 'no_match' }; },
        };
        const storage = { async readFile() { return Buffer.alloc(0); }, async deleteFile() { } };
        const useCase = new ReadInvoiceUseCase(storage, ai, new PrismaProductRepository(), new PrismaAuditLogRepository(), new PrismaStockRepository(), persistence);
        await useCase.execute({ filePath: 'audit-file', mimeType: 'image/png', stockId: stock.id, userId: owner.id });
        const logs = await prisma.auditLog.findMany({ where: { stockId: stock.id }, orderBy: { createdAt: 'asc' } });
        expect(logs).toHaveLength(2);
        expect(logs[0]).toMatchObject({
            action: 'CREATE', entity: 'INVOICE', entityId: accessKey,
            companyId: company.id, stockId: stock.id, userId: owner.id,
            description: 'Invoice processada com sucesso.', previousState: null,
            newState: { processedProductCount: 1, pendingSuggestionCount: 0 },
            createdAt: expect.any(Date),
        });
        expect(logs[1]).toMatchObject({
            action: 'UPDATE', entity: 'PRODUCT', entityId: existing.id,
            companyId: company.id, stockId: stock.id, userId: owner.id,
            description: 'Entrada de estoque processada por invoice.',
            previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
            newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
        });
        expect(JSON.stringify(logs)).not.toContain('sensitive-number');
        expect(JSON.stringify(logs)).not.toContain('Descrição não necessária');
        expect(JSON.stringify(logs)).not.toContain('11222333000181');
    });
    it('mantém commit e idempotência reais quando o audit pós-operação falha', async () => {
        const { owner, company, stock } = await seedOwnerAndStock();
        const accessKey = '80000000000000000000000000000000000000000008';
        await prisma.product.create({ data: product(stock.id, 'AUDIT-FAIL', 10, { unitPrice: 5, totalPrice: 50 }) });
        const extracted = {
            accessKey, invoiceNumber: '8', series: '1', issuedAt: new Date(), totalValue: 100,
            supplier: { cnpj: '11222333000181', name: 'Fornecedor' },
            products: [{ code: 'AUDIT-FAIL', description: 'Produto', quantity: 5, unitPrice: 20, totalPrice: 100, unitMeasurement: 'UN' }],
        };
        const ai = {
            async extractDanfeData() { return extracted; },
            async findSimilarProduct() { return { kind: 'no_match' }; },
        };
        const storage = { async readFile() { return Buffer.alloc(0); }, async deleteFile() { } };
        const failingAudit = {
            create: vi.fn().mockRejectedValue(new Error('controlled audit failure')),
            findByCompanyId: vi.fn(),
            findByUserId: vi.fn(),
        };
        const testLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const useCase = new ReadInvoiceUseCase(storage, ai, new PrismaProductRepository(), failingAudit, new PrismaStockRepository(), persistence, testLogger);
        await expect(useCase.execute({
            filePath: 'controlled-success-file', mimeType: 'image/png', stockId: stock.id,
            userId: owner.id, requestId: 'postgres-audit-failure',
        })).resolves.toBeDefined();
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
        let persisted = await prisma.product.findUniqueOrThrow({
            where: { stockId_code: { stockId: stock.id, code: 'AUDIT-FAIL' } },
        });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
        expect(await prisma.auditLog.count({ where: { entityId: accessKey } })).toBe(0);
        expect(failingAudit.create).toHaveBeenCalledWith(expect.objectContaining({ companyId: company.id }));
        expect(testLogger.error).toHaveBeenCalledTimes(2);
        await expect(useCase.execute({
            filePath: 'controlled-retry-file', mimeType: 'image/png', stockId: stock.id, userId: owner.id,
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(await prisma.processedInvoice.count({ where: { accessKey } })).toBe(1);
        persisted = await prisma.product.findUniqueOrThrow({
            where: { stockId_code: { stockId: stock.id, code: 'AUDIT-FAIL' } },
        });
        expect(Number(persisted.quantity)).toBe(15);
        expect(Number(persisted.unitPrice)).toBe(10);
        expect(failingAudit.create).toHaveBeenCalledTimes(2);
    });
    it('createWithDefaultStock: rollback real quando a segunda escrita (Stock) falha na mesma transação', async () => {
        const owner = await prisma.user.create({
            data: { email: `owner-${crypto.randomUUID()}@test.local`, name: 'Owner', password: 'test-hash' },
        });
        const companyRepository = new PrismaCompanyRepository();
        const cnpj = '04252011000110';
        // NUL byte é um valor de string TypeScript válido, mas o PostgreSQL rejeita em colunas de texto
        // (invalid byte sequence for encoding "UTF8": 0x00) — força uma falha real na segunda escrita (Stock),
        // depois que a primeira (Company) já foi executada dentro da mesma transação.
        await expect(companyRepository.createWithDefaultStock({ name: 'Empresa Atômica', cnpj, ownerId: owner.id }, 'Estoque Principal\u0000')).rejects.toThrow();
        expect(await prisma.company.count({ where: { cnpj } })).toBe(0);
        expect(await prisma.stock.count({ where: { company: { ownerId: owner.id } } })).toBe(0);
    });
    it('createWithDefaultStock: permite retry bem-sucedido com a mesma identidade após rollback anterior', async () => {
        const owner = await prisma.user.create({
            data: { email: `owner-${crypto.randomUUID()}@test.local`, name: 'Owner', password: 'test-hash' },
        });
        const companyRepository = new PrismaCompanyRepository();
        const cnpj = '12ABC34501DE35';
        await expect(companyRepository.createWithDefaultStock({ name: 'Empresa Atômica', cnpj, ownerId: owner.id }, 'Estoque Principal\u0000')).rejects.toThrow();
        expect(await prisma.company.count({ where: { cnpj } })).toBe(0);
        const { company, stock } = await companyRepository.createWithDefaultStock({ name: 'Empresa Atômica', cnpj, ownerId: owner.id }, 'Estoque Principal');
        expect(company.id).toEqual(expect.any(String));
        expect(stock.name).toBe('Estoque Principal');
        expect(stock.companyId).toBe(company.id);
        expect(await prisma.company.count({ where: { cnpj } })).toBe(1);
        expect(await prisma.stock.count({ where: { companyId: stock.companyId } })).toBe(1);
    });
    it('createWithDefaultStock: traduz P2002 real de CNPJ duplicado sem deixar Stock órfão', async () => {
        const owner = await prisma.user.create({
            data: { email: `owner-${crypto.randomUUID()}@test.local`, name: 'Owner', password: 'test-hash' },
        });
        const companyRepository = new PrismaCompanyRepository();
        const cnpj = '11444777000161';
        const first = await companyRepository.createWithDefaultStock({ name: 'Original', cnpj, ownerId: owner.id }, 'Estoque Principal');
        await expect(companyRepository.createWithDefaultStock({ name: 'Duplicada', cnpj, ownerId: owner.id }, 'Estoque Principal')).rejects.toMatchObject({ statusCode: 409 });
        expect(await prisma.company.count({ where: { cnpj } })).toBe(1);
        expect(await prisma.stock.count({ where: { companyId: first.stock.companyId } })).toBe(1);
    });
    it('M6-04: AuditLogMapper traduz enum, Json e nulos reais do Postgres em findByCompanyId/findByUserId', async () => {
        const { owner, company, stock } = await seedOwnerAndStock();
        const auditLogRepository = new PrismaAuditLogRepository();
        await auditLogRepository.create({
            action: 'UPDATE', entity: 'PRODUCT', entityId: 'product-1',
            userId: owner.id, companyId: company.id, stockId: stock.id,
            description: 'Entrada de estoque processada por invoice.',
            previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
            newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
        });
        await auditLogRepository.create({ action: 'UNAUTHORIZED_ACCESS', entity: 'INVOICE' });
        const byCompany = await auditLogRepository.findByCompanyId(company.id);
        expect(byCompany).toHaveLength(1);
        expect(byCompany[0]).toMatchObject({
            action: 'UPDATE', entity: 'PRODUCT', entityId: 'product-1',
            userId: owner.id, companyId: company.id, stockId: stock.id,
            previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
            newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
            createdAt: expect.any(Date),
        });
        const byUser = await auditLogRepository.findByUserId(owner.id);
        expect(byUser).toHaveLength(1);
        expect(byUser[0]?.id).toBe(byCompany[0]?.id);
        const unauthorized = await auditLogRepository.findByCompanyId('no-such-company');
        expect(unauthorized).toEqual([]);
    });
});
//# sourceMappingURL=postgres-gate.integration.spec.js.map