import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { IProduct } from './product.repository.js';

export async function upsertWeightedProductEntry(
  transaction: Prisma.TransactionClient,
  product: IProduct,
): Promise<Product> {
  const receivedQuantity = new Prisma.Decimal(product.quantity);
  const receivedUnitPrice = new Prisma.Decimal(product.unitPrice);
  const receivedTotalPrice = receivedQuantity.mul(receivedUnitPrice).toDecimalPlaces(2);

  const rows = await transaction.$queryRaw<Product[]>(Prisma.sql`
    INSERT INTO "products" (
      "id", "code", "description", "quantity", "unitMeasurement",
      "unitPrice", "totalPrice", "stockId", "userId", "createdAt"
    ) VALUES (
      ${product.id ?? randomUUID()}, ${product.code}, ${product.description}, ${receivedQuantity}, ${product.unitMeasurement},
      ${receivedUnitPrice}, ${receivedTotalPrice}, ${product.stockId}, ${product.userId ?? null}, NOW()
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
    RETURNING *
  `);

  const persisted = rows[0];
  if (!persisted) throw new Error('Product upsert returned no row.');
  return persisted;
}
