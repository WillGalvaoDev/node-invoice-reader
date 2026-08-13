import { describe, expect, it } from 'vitest';
import { InMemoryAuditLogRepository } from './in-memory/in-memory-audit-log.repository.js';

describe('AuditLogRepository contract', () => {
  it('preserva escopo, descrição e estados mínimos do evento', async () => {
    const repository = new InMemoryAuditLogRepository();

    const created = await repository.create({
      action: 'UPDATE', entity: 'PRODUCT', entityId: 'product-1',
      companyId: 'company-1', stockId: 'stock-1', userId: 'user-1',
      description: 'Entrada de estoque processada por invoice.',
      previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
      newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
    });

    expect(created).toMatchObject({
      stockId: 'stock-1', description: 'Entrada de estoque processada por invoice.',
      previousState: { quantity: 10, unitPrice: 5, totalPrice: 50 },
      newState: { quantity: 15, unitPrice: 10, totalPrice: 150 },
      createdAt: expect.any(Date),
    });
  });
});
