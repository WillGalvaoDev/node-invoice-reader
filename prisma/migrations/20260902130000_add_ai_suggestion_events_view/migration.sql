-- P3-02: eventos de sugestão (created/confirmed/rejected) correlacionáveis por
-- estoque, empresa e nota — como VIEW, não tabela nova.
--
-- Avaliação registrada (critério de aceite 1): todo o dado exigido já existe em
-- product_similarity_suggestions (confidence bruta, status, decidedAt,
-- decidedByUserId, stockId) e, desde P3-01, o correlationId da nota está em
-- processed_invoices. Uma tabela nova duplicaria esse estado sob um SEGUNDO
-- contrato de escrita (best-effort), introduzindo uma janela de divergência
-- que hoje não existe — a mesma classe de defeito que a separação
-- ledger/eventos (P4-02/P3-01) já existe para evitar. A view não tem esse
-- risco: não há escrita própria, então não há o que divergir nem o que falhar
-- — o critério de aceite "falha de registro não reverte a decisão" fica
-- automaticamente satisfeito, por não existir registro separado para falhar.
--
-- 'created' vem de createdAt (todo registro gera este evento); 'confirmed'/
-- 'rejected' vêm de decidedAt, só quando status já não é PENDING.
-- confidenceBucket NÃO é persistido aqui — a faixa é calculada na consulta,
-- nunca na emissão (critério de aceite 5).

CREATE VIEW "ai_suggestion_events" AS
SELECT
  pss."id" AS "suggestionId",
  pi."correlationId" AS "correlationId",
  pss."stockId" AS "stockId",
  s."companyId" AS "companyId",
  'created' AS "decision",
  pss."confidence" AS "confidence",
  NULL::TEXT AS "decidedByUserId",
  pss."createdAt" AS "eventAt"
FROM "product_similarity_suggestions" pss
JOIN "processed_invoices" pi ON pi."id" = pss."processedInvoiceId"
JOIN "stocks" s ON s."id" = pss."stockId"

UNION ALL

SELECT
  pss."id" AS "suggestionId",
  pi."correlationId" AS "correlationId",
  pss."stockId" AS "stockId",
  s."companyId" AS "companyId",
  CASE pss."status"
    WHEN 'CONFIRMED' THEN 'confirmed'
    WHEN 'REJECTED' THEN 'rejected'
  END AS "decision",
  pss."confidence" AS "confidence",
  pss."decidedByUserId" AS "decidedByUserId",
  pss."decidedAt" AS "eventAt"
FROM "product_similarity_suggestions" pss
JOIN "processed_invoices" pi ON pi."id" = pss."processedInvoiceId"
JOIN "stocks" s ON s."id" = pss."stockId"
WHERE pss."status" IN ('CONFIRMED', 'REJECTED');
