-- Suporta revogação determinística de tokens (P2-02): comparar authVersion com
-- a claim do JWT invalida todo token emitido antes da troca de senha, sem
-- depender de comparação de timestamp entre relógios distintos (iat vs now()).
-- Aditiva e segura: DEFAULT 1 preenche as linhas existentes sem backfill manual.
ALTER TABLE "users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
