import { Prisma } from '@prisma/client';
import type { IDanfeExtractResult } from '../providers/ai.provider.js';
import { AppError } from '../errors/app-error.js';

export const DANFE_TOTAL_TOLERANCE = new Prisma.Decimal('0.02');
const DANFE_ITEM_RELATIVE_TOLERANCE = new Prisma.Decimal('0.01');
const INCOHERENT_DANFE_MESSAGE = 'Os valores extraídos do DANFE são inconsistentes.';

export function assertDanfeCoherence(invoice: IDanfeExtractResult): void {
  for (const item of invoice.products) {
    const expectedItemTotal = new Prisma.Decimal(item.quantity).mul(item.unitPrice);
    const declaredItemTotal = new Prisma.Decimal(item.totalPrice);
    const allowedDifference = Prisma.Decimal.max(
      DANFE_TOTAL_TOLERANCE,
      expectedItemTotal.abs().mul(DANFE_ITEM_RELATIVE_TOLERANCE),
    );

    if (expectedItemTotal.sub(declaredItemTotal).abs().gt(allowedDifference)) {
      throw new AppError(INCOHERENT_DANFE_MESSAGE, 422);
    }
  }

  const itemsTotal = invoice.products.reduce(
    (sum, item) => sum.add(item.totalPrice),
    new Prisma.Decimal(0),
  );
  const declaredInvoiceTotal = new Prisma.Decimal(invoice.totalValue);

  if (itemsTotal.gt(declaredInvoiceTotal.add(DANFE_TOTAL_TOLERANCE))) {
    throw new AppError(INCOHERENT_DANFE_MESSAGE, 422);
  }
}
