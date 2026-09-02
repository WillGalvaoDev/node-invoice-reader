import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';
async function cleanDatabase() {
    await prisma.aiCallEvent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.productSimilaritySuggestion.deleteMany();
    await prisma.processedInvoice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
}
async function seedOwnerAndStock() {
    const owner = await prisma.user.create({
        data: { email: `runbook-owner-${crypto.randomUUID()}@test.local`, name: 'Owner', password: 'test-hash' },
    });
    const company = await prisma.company.create({
        data: { name: 'Empresa runbook', cnpj: '11222333000181', ownerId: owner.id },
    });
    const stock = await prisma.stock.create({ data: { name: 'Estoque runbook', companyId: company.id } });
    return { owner, company, stock };
}
function daysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
beforeEach(cleanDatabase);
afterAll(disconnectPrisma);
describe('Runbook de telemetria (P3-03) — as 8 perguntas do piloto', () => {
    it('1. latência avg/p50/p95 por operação', async () => {
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'q1-a', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 100, attempts: 1 },
                { correlationId: 'q1-b', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'failure', failureCategory: 'timeout', durationMs: 200, attempts: 2 },
                { correlationId: 'q1-c', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 10, attempts: 1 },
                { correlationId: 'q1-c', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 30, attempts: 1 },
            ],
        });
        const rows = await prisma.$queryRaw `
      SELECT
        operation,
        ROUND(AVG("durationMs")::numeric, 2) AS avg_ms,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2) AS p50_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2) AS p95_ms,
        COUNT(*) AS sample_size
      FROM ai_call_events
      GROUP BY operation
      ORDER BY operation
    `;
        expect(rows.map((row) => ({ ...row, avg_ms: String(row.avg_ms), p50_ms: String(row.p50_ms), p95_ms: String(row.p95_ms) }))).toEqual([
            { operation: 'invoice_extraction', avg_ms: '150', p50_ms: '150', p95_ms: '195', sample_size: 2n },
            { operation: 'product_similarity', avg_ms: '20', p50_ms: '20', p95_ms: '29', sample_size: 2n },
        ]);
    });
    it('2. tokens por nota', async () => {
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'q2-corr', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, totalTokens: 100 },
                { correlationId: 'q2-corr', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, totalTokens: 50 },
                { correlationId: 'q2-other', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'failure', durationMs: 1, attempts: 1 }, // sem totalTokens
            ],
        });
        const rows = await prisma.$queryRaw `
      SELECT "correlationId", SUM("totalTokens") AS total_tokens, COUNT(*) AS calls
      FROM ai_call_events
      WHERE "totalTokens" IS NOT NULL
      GROUP BY "correlationId"
      ORDER BY total_tokens DESC
    `;
        expect(rows).toEqual([{ correlationId: 'q2-corr', total_tokens: 150n, calls: 2n }]);
    });
    it('3. custo estimado por nota', async () => {
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'q3-corr', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, estimatedCostUsdNanos: 1000 },
                { correlationId: 'q3-corr', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, estimatedCostUsdNanos: 500 },
            ],
        });
        const rows = await prisma.$queryRaw `
      SELECT "correlationId", SUM("estimatedCostUsdNanos") AS estimated_cost_usd_nanos
      FROM ai_call_events
      WHERE "estimatedCostUsdNanos" IS NOT NULL
      GROUP BY "correlationId"
      ORDER BY estimated_cost_usd_nanos DESC
    `;
        expect(rows).toEqual([{ correlationId: 'q3-corr', estimated_cost_usd_nanos: 1500n }]);
    });
    it('4. custo por dia e acumulado do mês', async () => {
        const day1 = new Date('2026-01-05T12:00:00.000Z');
        const day2 = new Date('2026-01-06T12:00:00.000Z');
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'q4-a', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, estimatedCostUsdNanos: 1000, createdAt: day1 },
                { correlationId: 'q4-b', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, estimatedCostUsdNanos: 2000, createdAt: day2 },
            ],
        });
        const rows = await prisma.$queryRaw `
      SELECT
        date_trunc('day', "createdAt") AS day,
        SUM("estimatedCostUsdNanos") AS daily_cost_usd_nanos,
        SUM(SUM("estimatedCostUsdNanos")) OVER (
          PARTITION BY date_trunc('month', "createdAt")
          ORDER BY date_trunc('day', "createdAt")
        ) AS month_to_date_cost_usd_nanos
      FROM ai_call_events
      WHERE "estimatedCostUsdNanos" IS NOT NULL
      GROUP BY date_trunc('day', "createdAt"), date_trunc('month', "createdAt")
      ORDER BY day
    `;
        expect(rows.map((row) => ({ ...row, day: row.day.toISOString(), month_to_date_cost_usd_nanos: String(row.month_to_date_cost_usd_nanos) }))).toEqual([
            { day: '2026-01-05T00:00:00.000Z', daily_cost_usd_nanos: 1000n, month_to_date_cost_usd_nanos: '1000' },
            { day: '2026-01-06T00:00:00.000Z', daily_cost_usd_nanos: 2000n, month_to_date_cost_usd_nanos: '3000' },
        ]);
    });
    it('5. taxa de falha por failureCategory', async () => {
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'q5-1', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 },
                { correlationId: 'q5-2', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 },
                { correlationId: 'q5-3', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'failure', failureCategory: 'timeout', durationMs: 1, attempts: 2 },
                { correlationId: 'q5-4', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'failure', failureCategory: 'provider_error', durationMs: 1, attempts: 2 },
            ],
        });
        const rows = await prisma.$queryRaw `
      SELECT
        "failureCategory",
        COUNT(*) AS failures,
        ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM ai_call_events), 0), 4) AS share_of_all_calls
      FROM ai_call_events
      WHERE status = 'failure'
      GROUP BY "failureCategory"
      ORDER BY failures DESC, "failureCategory"
    `;
        expect(rows.map((row) => ({ ...row, share_of_all_calls: String(row.share_of_all_calls) }))).toEqual([
            { failureCategory: 'provider_error', failures: 1n, share_of_all_calls: '0.25' },
            { failureCategory: 'timeout', failures: 1n, share_of_all_calls: '0.25' },
        ]);
    });
    it('6. distribuição de confidence (sugestões criadas)', async () => {
        const { stock } = await seedOwnerAndStock();
        const invoice = await prisma.processedInvoice.create({ data: { accessKey: `q6-${crypto.randomUUID()}`, stockId: stock.id } });
        const products = await Promise.all([0.6, 0.8, 0.95].map((_, index) => prisma.product.create({ data: { code: `Q6-${index}`, description: 'produto', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: stock.id } })));
        await prisma.productSimilaritySuggestion.createMany({
            data: [0.6, 0.8, 0.95].map((confidence, index) => ({
                processedInvoiceId: invoice.id, itemIndex: index, stockId: stock.id, suggestedProductId: products[index].id,
                receivedCode: `Q6-RECV-${index}`, receivedDescription: 'produto recebido', receivedQuantity: 1, receivedUnitPrice: 1,
                unitMeasurement: 'UN', confidence, reason: 'teste',
            })),
        });
        const rows = await prisma.$queryRaw `
      SELECT
        CASE
          WHEN confidence < 0.70 THEN '0.00-0.69'
          WHEN confidence < 0.85 THEN '0.70-0.84'
          WHEN confidence < 0.95 THEN '0.85-0.94'
          ELSE '0.95-1.00'
        END AS confidence_band,
        COUNT(*) AS events
      FROM ai_suggestion_events
      WHERE decision = 'created'
      GROUP BY confidence_band
      ORDER BY confidence_band
    `;
        expect(rows).toEqual([
            { confidence_band: '0.00-0.69', events: 1n },
            { confidence_band: '0.70-0.84', events: 1n },
            { confidence_band: '0.95-1.00', events: 1n },
        ]);
    });
    it('7. taxa de aceitação/rejeição por faixa de confiança', async () => {
        const { owner, stock } = await seedOwnerAndStock();
        const invoice = await prisma.processedInvoice.create({ data: { accessKey: `q7-${crypto.randomUUID()}`, stockId: stock.id } });
        const [productConfirmed, productRejected, productLowBand] = await Promise.all(['CONFIRMED', 'REJECTED', 'LOW'].map((label) => prisma.product.create({ data: { code: `Q7-${label}`, description: 'produto', quantity: 1, unitMeasurement: 'UN', unitPrice: 1, totalPrice: 1, stockId: stock.id } })));
        await prisma.productSimilaritySuggestion.createMany({
            data: [
                { processedInvoiceId: invoice.id, itemIndex: 0, stockId: stock.id, suggestedProductId: productConfirmed.id, receivedCode: 'Q7-C', receivedDescription: 'r', receivedQuantity: 1, receivedUnitPrice: 1, unitMeasurement: 'UN', confidence: 0.96, reason: 't', status: 'CONFIRMED', decidedAt: new Date(), decidedByUserId: owner.id },
                { processedInvoiceId: invoice.id, itemIndex: 1, stockId: stock.id, suggestedProductId: productRejected.id, receivedCode: 'Q7-R', receivedDescription: 'r', receivedQuantity: 1, receivedUnitPrice: 1, unitMeasurement: 'UN', confidence: 0.97, reason: 't', status: 'REJECTED', decidedAt: new Date(), decidedByUserId: owner.id },
                { processedInvoiceId: invoice.id, itemIndex: 2, stockId: stock.id, suggestedProductId: productLowBand.id, receivedCode: 'Q7-L', receivedDescription: 'r', receivedQuantity: 1, receivedUnitPrice: 1, unitMeasurement: 'UN', confidence: 0.5, reason: 't', status: 'CONFIRMED', decidedAt: new Date(), decidedByUserId: owner.id },
            ],
        });
        const rows = await prisma.$queryRaw `
      SELECT
        CASE
          WHEN confidence < 0.70 THEN '0.00-0.69'
          WHEN confidence < 0.85 THEN '0.70-0.84'
          WHEN confidence < 0.95 THEN '0.85-0.94'
          ELSE '0.95-1.00'
        END AS confidence_band,
        COUNT(*) FILTER (WHERE decision = 'confirmed') AS confirmed,
        COUNT(*) FILTER (WHERE decision = 'rejected') AS rejected,
        ROUND(
          COUNT(*) FILTER (WHERE decision = 'confirmed')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE decision IN ('confirmed', 'rejected')), 0),
          4
        ) AS acceptance_rate
      FROM ai_suggestion_events
      WHERE decision IN ('confirmed', 'rejected')
      GROUP BY confidence_band
      ORDER BY confidence_band
    `;
        expect(rows.map((row) => ({ ...row, acceptance_rate: String(row.acceptance_rate) }))).toEqual([
            { confidence_band: '0.00-0.69', confirmed: 1n, rejected: 0n, acceptance_rate: '1' },
            { confidence_band: '0.95-1.00', confirmed: 1n, rejected: 1n, acceptance_rate: '0.5' },
        ]);
    });
    it('8. chamadas product_similarity por nota (distribuição)', async () => {
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'q8-many', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 },
                { correlationId: 'q8-many', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 },
                { correlationId: 'q8-many', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 },
                { correlationId: 'q8-few', operation: 'product_similarity', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 },
                { correlationId: 'q8-many', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1 }, // não deve entrar na contagem
            ],
        });
        const rows = await prisma.$queryRaw `
      WITH per_invoice AS (
        SELECT "correlationId", COUNT(*) AS similarity_calls
        FROM ai_call_events
        WHERE operation = 'product_similarity'
        GROUP BY "correlationId"
      )
      SELECT
        ROUND(AVG(similarity_calls)::numeric, 2) AS avg_calls,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY similarity_calls) AS p50_calls,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY similarity_calls) AS p95_calls,
        MAX(similarity_calls) AS max_calls,
        COUNT(*) AS invoices_with_similarity_calls
      FROM per_invoice
    `;
        expect(rows.map((row) => ({ ...row, avg_calls: String(row.avg_calls) }))).toEqual([
            { avg_calls: '2', p50_calls: 2, p95_calls: 2.9, max_calls: 3n, invoices_with_similarity_calls: 2n },
        ]);
    });
});
describe('Retenção de ai_call_events (P3-03, D2 — 60 dias)', () => {
    it('remove só o que passou de 60 dias, preserva o resto e nunca toca AuditLog; idempotente', async () => {
        await prisma.aiCallEvent.createMany({
            data: [
                { correlationId: 'old', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, createdAt: daysAgo(61) },
                { correlationId: 'recent', operation: 'invoice_extraction', model: 'gemini-2.5-flash', status: 'success', durationMs: 1, attempts: 1, createdAt: daysAgo(10) },
            ],
        });
        const oldAuditLogCreatedAt = daysAgo(100);
        const oldAuditLog = await prisma.auditLog.create({
            data: { action: 'CREATE', entity: 'COMPANY', description: 'evento antigo de auditoria, não deve ser afetado', createdAt: oldAuditLogCreatedAt },
        });
        const output = execFileSync('node', ['scripts/purge-ai-call-events.mjs'], { env: process.env, encoding: 'utf-8' });
        expect(output).toContain('1 linha(s)');
        const remaining = await prisma.aiCallEvent.findMany();
        expect(remaining).toHaveLength(1);
        expect(remaining[0]?.correlationId).toBe('recent');
        expect(await prisma.auditLog.count()).toBe(1);
        expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: oldAuditLog.id } })).createdAt.getTime()).toBe(oldAuditLogCreatedAt.getTime());
        const secondRunOutput = execFileSync('node', ['scripts/purge-ai-call-events.mjs'], { env: process.env, encoding: 'utf-8' });
        expect(secondRunOutput).toContain('0 linha(s)');
        expect(await prisma.aiCallEvent.count()).toBe(1);
    });
});
//# sourceMappingURL=telemetry-runbook.integration.spec.js.map