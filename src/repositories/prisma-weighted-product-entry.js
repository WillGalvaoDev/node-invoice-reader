import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ProductOriginConflictError } from '../domain/product-origin.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
// Mesma normalização de `normalizeUnitMeasurement` (espaços colapsados, caixa baixa).
// Atenção: em template literal, `\s` seria interpretado como `s`; o padrão vai como parâmetro.
const WHITESPACE_RUN = '\\s+';
const normalizedUnit = (column) => Prisma.sql `lower(btrim(regexp_replace(${column}, ${WHITESPACE_RUN}, ' ', 'g')))`;
/**
 * Entrada ponderada atômica sobre `(stockId, code)`. A compatibilidade é
 * revalidada na própria cláusula ON CONFLICT: sob concorrência, o perdedor da
 * corrida avalia a linha já confirmada pelo vencedor e não soma em silêncio.
 */
export async function upsertWeightedProductEntry(transaction, product, { requireSameOrigin }) {
    const receivedQuantity = new Prisma.Decimal(product.quantity);
    const receivedUnitPrice = new Prisma.Decimal(product.unitPrice);
    const receivedTotalPrice = receivedQuantity.mul(receivedUnitPrice).toDecimalPlaces(2);
    const unitGuard = Prisma.sql `${normalizedUnit(Prisma.sql `"products"."unitMeasurement"`)} = ${normalizedUnit(Prisma.sql `EXCLUDED."unitMeasurement"`)}`;
    const originGuard = requireSameOrigin
        ? Prisma.sql `AND "products"."sourceSupplierCnpj" IS NOT NULL AND "products"."sourceSupplierCnpj" = EXCLUDED."sourceSupplierCnpj"`
        : Prisma.empty;
    const rows = await transaction.$queryRaw(Prisma.sql `
    INSERT INTO "products" (
      "id", "code", "description", "quantity", "unitMeasurement",
      "unitPrice", "totalPrice", "stockId", "userId", "sourceSupplierCnpj", "createdAt"
    ) VALUES (
      ${product.id ?? randomUUID()}, ${product.code}, ${product.description}, ${receivedQuantity}, ${product.unitMeasurement},
      ${receivedUnitPrice}, ${receivedTotalPrice}, ${product.stockId}, ${product.userId ?? null},
      ${product.sourceSupplierCnpj ?? null}, NOW()
    )
    ON CONFLICT ("stockId", "code") DO UPDATE SET
      "quantity" = "products"."quantity" + EXCLUDED."quantity",
      "unitPrice" = ROUND(
        (
          "products"."quantity" * "products"."unitPrice"
          + EXCLUDED."quantity" * EXCLUDED."unitPrice"
        ) / NULLIF("products"."quantity" + EXCLUDED."quantity", 0),
        2
      ),
      "totalPrice" = ROUND(
        ("products"."quantity" + EXCLUDED."quantity")
        * ROUND(
          (
            "products"."quantity" * "products"."unitPrice"
            + EXCLUDED."quantity" * EXCLUDED."unitPrice"
          ) / NULLIF("products"."quantity" + EXCLUDED."quantity", 0),
          2
        ),
        2
      )
    WHERE ${unitGuard} ${originGuard}
    RETURNING *
  `);
    const persisted = rows[0];
    // Sem linha retornada: o conflito existiu e a guarda recusou o acúmulo.
    if (!persisted)
        throw new ProductOriginConflictError();
    return persisted;
}
/** Cria um produto novo; código já existente no estoque é conflito (409), nunca acúmulo. */
export async function insertNewProductEntry(transaction, product) {
    const quantity = new Prisma.Decimal(product.quantity);
    const unitPrice = new Prisma.Decimal(product.unitPrice);
    try {
        return await transaction.product.create({
            data: {
                code: product.code,
                description: product.description,
                quantity,
                unitMeasurement: product.unitMeasurement,
                unitPrice,
                totalPrice: quantity.mul(unitPrice).toDecimalPlaces(2),
                stockId: product.stockId,
                userId: product.userId ?? null,
                sourceSupplierCnpj: product.sourceSupplierCnpj ?? null,
            },
        });
    }
    catch (error) {
        if (isPrismaErrorCode(error, 'P2002')) {
            throw new AppError('Já existe um produto com este código no estoque. A sugestão continua pendente.', 409);
        }
        throw error;
    }
}
//# sourceMappingURL=prisma-weighted-product-entry.js.map