-- DP-02: ambiente de demonstracao por visitante. Migration aditiva (somente novas tabelas).
CREATE TYPE "DemoSessionState" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "DemoDocumentKind" AS ENUM ('INITIAL', 'FOLLOWUP');

CREATE TABLE "demo_sessions" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "state" "DemoSessionState" NOT NULL DEFAULT 'ACTIVE',
    "successorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "demo_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "demo_document_keys" (
    "accessKey" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "DemoDocumentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_document_keys_pkey" PRIMARY KEY ("accessKey")
);

CREATE UNIQUE INDEX "demo_sessions_companyId_key" ON "demo_sessions"("companyId");
CREATE UNIQUE INDEX "demo_sessions_successorId_key" ON "demo_sessions"("successorId");
CREATE INDEX "demo_sessions_ownerId_state_idx" ON "demo_sessions"("ownerId", "state");
CREATE UNIQUE INDEX "demo_document_keys_sessionId_kind_key" ON "demo_document_keys"("sessionId", "kind");

-- Invariante: no maximo uma sessao ativa por usuario, garantida pelo banco.
CREATE UNIQUE INDEX "demo_sessions_one_active_per_owner" ON "demo_sessions"("ownerId") WHERE "state" = 'ACTIVE';

ALTER TABLE "demo_sessions" ADD CONSTRAINT "demo_sessions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_sessions" ADD CONSTRAINT "demo_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_sessions" ADD CONSTRAINT "demo_sessions_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_sessions" ADD CONSTRAINT "demo_sessions_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "demo_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demo_document_keys" ADD CONSTRAINT "demo_document_keys_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
