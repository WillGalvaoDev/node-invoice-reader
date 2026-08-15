-- Substitui o índice de coluna única por um índice composto que também serve a
-- consulta paginada real de produtos (findPageByStockId: where stockId, order by
-- createdAt desc, id desc). O índice único (stockId, code) continua cobrindo os
-- lookups por código.
DROP INDEX "products_stockId_idx";
CREATE INDEX "products_stockId_createdAt_id_idx" ON "products"("stockId", "createdAt" DESC, "id" DESC);

-- Cobrem os métodos reais e testados IAuditLogRepository.findByCompanyId e
-- findByUserId (where companyId/userId, order by createdAt desc). audit_logs é a
-- tabela de maior crescimento do sistema e não possuía nenhum índice além da PK.
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt" DESC);
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);
