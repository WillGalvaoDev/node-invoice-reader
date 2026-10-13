import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { env } from '../../src/config/env.js';
import { PrismaProductRepository } from '../../src/repositories/prisma-product.repository.js';
import { PrismaStockRepository } from '../../src/repositories/prisma-stock.repository.js';
import { PrismaAuditLogRepository } from '../../src/repositories/prisma-audit-log.repository.js';
import { PrismaInvoicePersistenceRepository } from '../../src/repositories/prisma-invoice-persistence.repository.js';
import { PrismaProductSuggestionRepository } from '../../src/repositories/prisma-product-suggestion.repository.js';
import { PrismaAiUsageLedgerRepository } from '../../src/repositories/prisma-ai-usage-ledger.repository.js';
import { PrismaDemoSessionRepository } from '../../src/repositories/prisma-demo-session.repository.js';
import { PrismaAiTelemetry } from '../../src/infra/prisma-ai-telemetry.js';
import { AiBudgetGuard } from '../../src/providers/ai-budget-guard.js';
import { GeminiAiProvider } from '../../src/providers/gemini-ai.provider.js';
import { ReadInvoiceUseCase } from '../../src/use-cases/read-invoice/read-invoice.use-case.js';
import { ConfirmProductSuggestionUseCase } from '../../src/use-cases/product-suggestions/confirm-product-suggestion.use-case.js';
import { RejectProductSuggestionUseCase } from '../../src/use-cases/product-suggestions/reject-product-suggestion.use-case.js';
import { PrepareDemoSessionUseCase } from '../../src/use-cases/demo/prepare-demo-session.use-case.js';
import { RestartDemoSessionUseCase } from '../../src/use-cases/demo/restart-demo-session.use-case.js';
import { GetDemoDocumentUseCase } from '../../src/use-cases/demo/get-demo-document.use-case.js';
import { buildDemoInvoice } from '../../src/demo/demo-scenario.js';
const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', async (importOriginal) => ({
    ...await importOriginal(),
    GoogleGenAI: class {
        models = { generateContent };
    },
}));
let directory;
beforeEach(async () => {
    vi.resetAllMocks();
    env.GEMINI_QUOTA_ENFORCEMENT_ENABLED = false;
    directory = await mkdtemp(join(tmpdir(), 'docscan-demo-flow-'));
    await prisma.demoDocumentKey.deleteMany();
    await prisma.demoSession.deleteMany();
    await prisma.aiCallEvent.deleteMany();
    await prisma.aiUsageLedger.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.productSimilaritySuggestion.deleteMany();
    await prisma.processedInvoice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.stockPermission.deleteMany();
    await prisma.companyCollaborator.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
});
afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
});
afterAll(disconnectPrisma);
const sessions = new PrismaDemoSessionRepository();
const products = new PrismaProductRepository();
const stocks = new PrismaStockRepository();
const audit = new PrismaAuditLogRepository();
const suggestions = new PrismaProductSuggestionRepository();
const aiResponse = (value) => ({
    text: JSON.stringify(value),
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
});
function readInvoiceUseCase() {
    const storage = { readFile, deleteFile: vi.fn().mockResolvedValue(undefined) };
    const ai = new GeminiAiProvider({
        telemetry: new PrismaAiTelemetry(),
        budgetGuard: new AiBudgetGuard(new PrismaAiUsageLedgerRepository(), 'gemini-2.5-flash'),
    });
    return { storage, sut: new ReadInvoiceUseCase(storage, ai, products, audit, stocks, new PrismaInvoicePersistenceRepository()) };
}
const user = (email) => prisma.user.create({ data: { email, name: email, password: 'synthetic' } });
/** Baixa o PDF da sessão pelo caso de uso real e o grava em disco para o pipeline de leitura. */
async function downloadDocument(userId, sessionId, kind) {
    const { content } = await new GetDemoDocumentUseCase(sessions).execute({ userId, sessionId, kind });
    const path = join(directory, `${sessionId}-${kind}.pdf`);
    await writeFile(path, content);
    return path;
}
async function uploadInitial(userId, session) {
    const { sut } = readInvoiceUseCase();
    generateContent.mockResolvedValueOnce(aiResponse(buildDemoInvoice('initial', session.id)));
    return sut.execute({ filePath: await downloadDocument(userId, session.id, 'initial'), mimeType: 'application/pdf', stockId: session.stockId, userId });
}
async function uploadFollowup(userId, session) {
    const { sut } = readInvoiceUseCase();
    const existing = await prisma.product.findFirstOrThrow({ where: { stockId: session.stockId, code: 'CAN-A' } });
    generateContent
        .mockResolvedValueOnce(aiResponse(buildDemoInvoice('followup', session.id)))
        .mockResolvedValueOnce(aiResponse({ matchFound: false, matchedProductId: '', confidence: 0, reason: 'Caderno e caneta são distintos.' }))
        .mockResolvedValueOnce(aiResponse({ matchFound: true, matchedProductId: existing.id, confidence: 0.95, reason: 'Mesma caneta.' }));
    return sut.execute({ filePath: await downloadDocument(userId, session.id, 'followup'), mimeType: 'application/pdf', stockId: session.stockId, userId });
}
const catalog = async (stockId) => Object.fromEntries((await products.findByStockId(stockId)).map((item) => [item.code, item.quantity]));
describe('fluxo completo por sessão de demonstração (DP-02)', () => {
    it('S01/S06: preparar e baixar documentos não consome IA nem altera o estoque', async () => {
        const owner = await user('a@example.test');
        const { session } = await new PrepareDemoSessionUseCase(sessions).execute({ userId: owner.id });
        await downloadDocument(owner.id, session.id, 'initial');
        await downloadDocument(owner.id, session.id, 'followup');
        expect(generateContent).not.toHaveBeenCalled();
        expect(await prisma.aiCallEvent.count()).toBe(0);
        expect(await prisma.aiUsageLedger.count()).toBe(0);
        expect(await products.findByStockId(session.stockId)).toEqual([]);
        expect(await prisma.processedInvoice.count()).toBe(0);
    });
    it.each(['confirm', 'reject'])('S10: percorre o cenário e decide com %s', async (decision) => {
        const owner = await user('a@example.test');
        const { session } = await new PrepareDemoSessionUseCase(sessions).execute({ userId: owner.id });
        const initial = await uploadInitial(owner.id, session);
        expect(initial.suggestions).toEqual([]);
        expect(await catalog(session.stockId)).toEqual({ 'CAN-A': 10 });
        const followup = await uploadFollowup(owner.id, session);
        expect(followup.suggestions).toHaveLength(1);
        // Antes da decisão humana a quantidade pendente não conta como disponível.
        expect(await catalog(session.stockId)).toEqual({ 'CAN-A': 12, 'CAD-A': 1 });
        expect(generateContent).toHaveBeenCalledTimes(4);
        const command = decision === 'confirm'
            ? new ConfirmProductSuggestionUseCase(suggestions, stocks, audit)
            : new RejectProductSuggestionUseCase(suggestions, stocks, audit);
        await command.execute({ suggestionId: followup.suggestions[0].id, userId: owner.id });
        expect(await catalog(session.stockId)).toEqual(decision === 'confirm'
            ? { 'CAN-A': 15, 'CAD-A': 1 }
            : { 'CAN-A': 12, 'CAD-A': 1, 'CAN-B': 3 });
        expect(await prisma.aiUsageLedger.count({ where: { reservedRequests: { gt: 0 } } })).toBe(0);
    });
    it('S07: reenviar o mesmo documento é duplicata sem movimentar estoque; sessão nova processa normalmente', async () => {
        const owner = await user('a@example.test');
        const { session } = await new PrepareDemoSessionUseCase(sessions).execute({ userId: owner.id });
        await uploadInitial(owner.id, session);
        await expect(uploadInitial(owner.id, session)).rejects.toMatchObject({ statusCode: 409 });
        expect(await catalog(session.stockId)).toEqual({ 'CAN-A': 10 });
        expect(await prisma.processedInvoice.count()).toBe(1);
        const restarted = await new RestartDemoSessionUseCase(sessions).execute({ userId: owner.id, sessionId: session.id });
        expect(restarted.stockId).not.toBe(session.stockId);
        expect(await products.findByStockId(restarted.stockId)).toEqual([]);
        await uploadInitial(owner.id, restarted);
        expect(await catalog(restarted.stockId)).toEqual({ 'CAN-A': 10 });
        // O estoque arquivado não foi alterado pelo novo processamento.
        expect(await catalog(session.stockId)).toEqual({ 'CAN-A': 10 });
        expect(await prisma.processedInvoice.count()).toBe(2);
    });
    it('S01: dois visitantes concluem cenários independentes com os mesmos documentos lógicos', async () => {
        const [a, b] = [await user('a@example.test'), await user('b@example.test')];
        const prepare = new PrepareDemoSessionUseCase(sessions);
        const { session: sessionA } = await prepare.execute({ userId: a.id });
        const { session: sessionB } = await prepare.execute({ userId: b.id });
        await uploadInitial(a.id, sessionA);
        await uploadInitial(b.id, sessionB);
        expect(await catalog(sessionA.stockId)).toEqual({ 'CAN-A': 10 });
        expect(await catalog(sessionB.stockId)).toEqual({ 'CAN-A': 10 });
        expect(await prisma.processedInvoice.count()).toBe(2);
        // Isolamento: B não baixa o documento de A nem opera seu estoque.
        await expect(new GetDemoDocumentUseCase(sessions).execute({ userId: b.id, sessionId: sessionA.id, kind: 'initial' }))
            .rejects.toMatchObject({ statusCode: 404 });
        await expect(uploadInitial(b.id, sessionA)).rejects.toMatchObject({ statusCode: 404 });
    });
});
//# sourceMappingURL=demo-session-flow.integration.spec.js.map