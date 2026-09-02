-- P4-02 (D8): registro autoritativo de consumo de Gemini — escrita forte, fail-closed.
-- Aditiva: tabela nova, nenhum dado existente é tocado.

-- CreateTable
CREATE TABLE "ai_usage_ledger" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "periodKind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reservedRequests" INTEGER NOT NULL DEFAULT 0,
    "spentRequests" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    "spentTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedCostUsdNanos" INTEGER NOT NULL DEFAULT 0,
    "spentCostUsdNanos" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_ledger_scope_scopeId_periodKind_period_key" ON "ai_usage_ledger"("scope", "scopeId", "periodKind", "period");
