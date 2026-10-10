import { readFile } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
import { env } from '../../src/config/env.js';
import { PrismaProductRepository } from '../../src/repositories/prisma-product.repository.js';
import { PrismaStockRepository } from '../../src/repositories/prisma-stock.repository.js';
import { PrismaAuditLogRepository } from '../../src/repositories/prisma-audit-log.repository.js';
import { PrismaInvoicePersistenceRepository } from '../../src/repositories/prisma-invoice-persistence.repository.js';
import { PrismaProductSuggestionRepository } from '../../src/repositories/prisma-product-suggestion.repository.js';
import { PrismaAiUsageLedgerRepository } from '../../src/repositories/prisma-ai-usage-ledger.repository.js';
import { PrismaAiTelemetry } from '../../src/infra/prisma-ai-telemetry.js';
import { AiBudgetGuard } from '../../src/providers/ai-budget-guard.js';
import { GeminiAiProvider } from '../../src/providers/gemini-ai.provider.js';
import { ReadInvoiceUseCase } from '../../src/use-cases/read-invoice/read-invoice.use-case.js';
import { ConfirmProductSuggestionUseCase } from '../../src/use-cases/product-suggestions/confirm-product-suggestion.use-case.js';
import { RejectProductSuggestionUseCase } from '../../src/use-cases/product-suggestions/reject-product-suggestion.use-case.js';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', async (importOriginal) => ({
  ...await importOriginal<typeof import('@google/genai')>(),
  GoogleGenAI: class { models = { generateContent }; },
}));

beforeEach(async () => {
  vi.resetAllMocks();
  env.GEMINI_QUOTA_ENFORCEMENT_ENABLED = false;
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
afterAll(disconnectPrisma);

describe('demonstração: domínio, Prisma, provider e ledger reais; somente SDK Gemini substituído', () => {
  it.each(['confirm', 'reject'] as const)('executa exemplo mínimo e ampliado, decisão %s, sem cota interna', async (decision) => {
    const fixture = JSON.parse(await readFile('examples/demo/scenario.json', 'utf8'));
    const owner = await prisma.user.create({ data: { email: 'demo@example.test', name: 'Demo', password: 'synthetic' } });
    const company = await prisma.company.create({ data: { name: 'Demo', cnpj: '11222333000181', ownerId: owner.id } });
    const stock = await prisma.stock.create({ data: { name: 'Demo', companyId: company.id } });
    const period = new Date().toISOString().slice(0, 10);
    await prisma.aiUsageLedger.createMany({ data: [
      { scope: 'global', scopeId: 'global', periodKind: 'day', period, spentRequests: 18 },
      { scope: 'user', scopeId: owner.id, periodKind: 'day', period, spentRequests: 5 },
    ] });
    const products = new PrismaProductRepository();
    const stocks = new PrismaStockRepository();
    const audit = new PrismaAuditLogRepository();
    const suggestions = new PrismaProductSuggestionRepository();
    const storage = { readFile, deleteFile: vi.fn().mockResolvedValue(undefined) };
    const ai = new GeminiAiProvider({ telemetry: new PrismaAiTelemetry(), budgetGuard: new AiBudgetGuard(new PrismaAiUsageLedgerRepository(), 'gemini-2.5-flash') });
    const sut = new ReadInvoiceUseCase(storage, ai, products, audit, stocks, new PrismaInvoicePersistenceRepository());
    const response = (value: unknown) => ({ text: JSON.stringify(value), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } });
    generateContent.mockResolvedValueOnce(response(fixture.initial));
    const initial = await sut.execute({ filePath: 'output/pdf/demo-inicial.pdf', mimeType: 'application/pdf', stockId: stock.id, userId: owner.id });
    expect(initial.processedProducts).toHaveLength(1);
    expect(initial.suggestions).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const existing = await prisma.product.findFirstOrThrow({ where: { stockId: stock.id, code: 'CAN-A' } });
    generateContent
      .mockResolvedValueOnce(response(fixture.followup))
      .mockResolvedValueOnce(response({ matchFound: false, matchedProductId: '', confidence: 0, reason: 'Caderno e caneta são distintos.' }))
      .mockResolvedValueOnce(response({ matchFound: true, matchedProductId: existing.id, confidence: 0.95, reason: 'Mesma caneta.' }));
    const result = await sut.execute({ filePath: 'output/pdf/demo-completa.pdf', mimeType: 'application/pdf', stockId: stock.id, userId: owner.id });
    expect(result.processedProducts).toHaveLength(2);
    expect(result.suggestions).toHaveLength(1);
    expect(generateContent).toHaveBeenCalledTimes(4);
    const suggestionId = result.suggestions[0]!.id;
    const command = decision === 'confirm'
      ? new ConfirmProductSuggestionUseCase(suggestions, stocks, audit)
      : new RejectProductSuggestionUseCase(suggestions, stocks, audit);
    await command.execute({ suggestionId, userId: owner.id });
    const catalog = await products.findByStockId(stock.id);
    expect(catalog.find((item) => item.code === 'CAN-A')?.quantity).toBe(decision === 'confirm' ? 15 : 12);
    expect(catalog.find((item) => item.code === 'CAD-A')?.quantity).toBe(1);
    expect(catalog.find((item) => item.code === 'CAN-B')?.quantity).toBe(decision === 'reject' ? 3 : undefined);
    expect(await prisma.processedInvoice.count()).toBe(2);
    expect(await prisma.aiCallEvent.count()).toBe(4);
    const ledger = await prisma.aiUsageLedger.findMany({ orderBy: { scope: 'asc' } });
    expect(ledger).toEqual([
      expect.objectContaining({ spentRequests: 22, reservedRequests: 0, spentTokens: 60 }),
      expect.objectContaining({ spentRequests: 9, reservedRequests: 0, spentTokens: 60 }),
    ]);
    expect(storage.deleteFile).toHaveBeenCalledTimes(2);
  });
});
