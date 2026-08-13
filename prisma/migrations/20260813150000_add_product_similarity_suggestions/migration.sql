CREATE TYPE "ProductSuggestionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "product_similarity_suggestions" (
    "id" TEXT NOT NULL,
    "processedInvoiceId" TEXT NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "stockId" TEXT NOT NULL,
    "suggestedProductId" TEXT NOT NULL,
    "receivedCode" TEXT NOT NULL,
    "receivedDescription" TEXT NOT NULL,
    "receivedQuantity" DECIMAL(12,4) NOT NULL,
    "receivedUnitPrice" DECIMAL(12,2) NOT NULL,
    "unitMeasurement" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ProductSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_similarity_suggestions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_similarity_suggestions_receivedQuantity_check" CHECK ("receivedQuantity" > 0),
    CONSTRAINT "product_similarity_suggestions_receivedUnitPrice_check" CHECK ("receivedUnitPrice" > 0),
    CONSTRAINT "product_similarity_suggestions_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

CREATE UNIQUE INDEX "product_similarity_suggestions_processedInvoiceId_itemIndex_key"
ON "product_similarity_suggestions"("processedInvoiceId", "itemIndex");
CREATE INDEX "product_similarity_suggestions_stockId_status_idx"
ON "product_similarity_suggestions"("stockId", "status");

ALTER TABLE "product_similarity_suggestions" ADD CONSTRAINT "product_similarity_suggestions_processedInvoiceId_fkey"
FOREIGN KEY ("processedInvoiceId") REFERENCES "processed_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_similarity_suggestions" ADD CONSTRAINT "product_similarity_suggestions_stockId_fkey"
FOREIGN KEY ("stockId") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_similarity_suggestions" ADD CONSTRAINT "product_similarity_suggestions_suggestedProductId_fkey"
FOREIGN KEY ("suggestedProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_similarity_suggestions" ADD CONSTRAINT "product_similarity_suggestions_decidedByUserId_fkey"
FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
