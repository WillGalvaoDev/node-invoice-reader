-- CreateTable
CREATE TABLE "processed_invoices" (
    "id" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_invoices_accessKey_key" ON "processed_invoices"("accessKey");

-- AddForeignKey
ALTER TABLE "processed_invoices" ADD CONSTRAINT "processed_invoices_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
