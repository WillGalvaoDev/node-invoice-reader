-- P3-01: observabilidade de chamadas de IA, correlacionável por nota via correlationId
-- gerado no servidor (nunca aceito do cliente). Aditiva: tabela nova + coluna nullable.
-- Best-effort por contrato — nunca autoridade de gasto (ver ai_usage_ledger, P4-02).

-- AlterTable
ALTER TABLE "processed_invoices" ADD COLUMN "correlationId" TEXT;

-- CreateTable
CREATE TABLE "ai_call_events" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "requestId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT,
    "status" TEXT NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "attempts" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsdNanos" INTEGER,
    "failureCategory" TEXT,
    "userId" TEXT,
    "companyId" TEXT,
    "stockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_call_events_createdAt_idx" ON "ai_call_events"("createdAt");

-- CreateIndex
CREATE INDEX "ai_call_events_correlationId_idx" ON "ai_call_events"("correlationId");

-- CreateIndex
CREATE INDEX "ai_call_events_operation_createdAt_idx" ON "ai_call_events"("operation", "createdAt");
