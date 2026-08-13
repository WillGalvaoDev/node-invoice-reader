import type { AuditAction, Prisma } from '@prisma/client';
import { ProductMapper } from '../mappers/product.mapper.js';
import { prisma } from '../infra/prisma.js';
import type { IInvoicePersistencePlan, IInvoicePersistenceRepository } from './invoice-persistence.repository.js';
import type { IProduct } from './product.repository.js';
import { AppError } from '../errors/app-error.js';

export class PrismaInvoicePersistenceRepository implements IInvoicePersistenceRepository {
  async persist({ accessKey, stockId, operations, auditLog }: IInvoicePersistencePlan): Promise<IProduct[]> {
    return prisma.$transaction(async (transaction) => {
      const products: IProduct[] = [];

      try {
        await transaction.processedInvoice.create({
          data: { accessKey, stockId },
        });
      } catch (error) {
        if (this.isUniqueConstraintViolation(error)) {
          throw new AppError('Esta NF-e já foi processada.', 409);
        }

        throw error;
      }

      for (const { product } of operations) {
        const persisted = await this.upsertProduct(transaction, product);
        products.push(ProductMapper.toDomain(persisted));
      }

      await transaction.auditLog.create({
        data: {
          action: auditLog.action as AuditAction,
          entity: auditLog.entity,
          ...(auditLog.entityId && { entityId: auditLog.entityId }),
          ...(auditLog.details && { details: auditLog.details }),
          ...(auditLog.userId && { userId: auditLog.userId }),
          ...(auditLog.companyId && { companyId: auditLog.companyId }),
        },
      });

      return products;
    });
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private upsertProduct(transaction: Prisma.TransactionClient, product: IProduct) {
    return transaction.product.upsert({
      where: {
        stockId_code: { stockId: product.stockId, code: product.code },
      },
      create: {
        code: product.code,
        description: product.description,
        quantity: product.quantity,
        unitMeasurement: product.unitMeasurement,
        unitPrice: product.unitPrice,
        totalPrice: product.totalPrice,
        stockId: product.stockId,
        userId: product.userId ?? null,
      },
      update: {
        quantity: { increment: product.quantity },
        unitPrice: product.unitPrice,
        totalPrice: product.totalPrice,
        description: product.description,
      },
    });
  }
}
