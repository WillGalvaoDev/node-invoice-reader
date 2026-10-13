-- DP-01: origem conhecida do produto e da sugestao. Aditiva e nullable:
-- a versao anterior da aplicacao continua funcionando sobre o schema expandido.
ALTER TABLE "products" ADD COLUMN "sourceSupplierCnpj" TEXT;
ALTER TABLE "product_similarity_suggestions" ADD COLUMN "receivedSupplierCnpj" TEXT;
