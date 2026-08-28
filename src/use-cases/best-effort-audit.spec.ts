import { describe, expect, it, vi } from 'vitest';
import { persistAuditBestEffort } from './best-effort-audit.js';
import { auditEvents } from './audit-events.js';
import { InMemoryAuditLogRepository } from '../repositories/in-memory/in-memory-audit-log.repository.js';
import type { AuditLogWrite, IAuditLogRepository } from '../repositories/audit-log.repository.js';

const silentLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const forced = (payload: unknown): AuditLogWrite => payload as AuditLogWrite;

const companyCreated = () => auditEvents.companyCreated({
  userId: 'user-1', companyId: 'company-1', stockId: 'stock-1', defaultStockId: 'stock-1',
});

describe('persistAuditBestEffort', () => {
  it('persiste o evento quando o repositório aceita', async () => {
    const repository = new InMemoryAuditLogRepository();

    await persistAuditBestEffort({ repository, logger: silentLogger(), log: companyCreated() });

    expect(repository.items).toHaveLength(1);
  });

  // A barreira estrutural é de compile time; o guard de runtime é rede de segurança.
  // Rede de segurança não pode derrubar a operação de negócio já concluída.
  it('absorve a recusa do guard sem propagar erro, preservando a semântica best-effort', async () => {
    const repository = new InMemoryAuditLogRepository();
    const logger = silentLogger();
    const invalid = forced({
      action: 'CREATE', entity: 'COMPANY', description: 'x',
      previousState: null, newState: { companyId: 'company-1', password: 'hunter2' },
    });

    await expect(
      persistAuditBestEffort({ repository, logger, log: invalid, requestId: 'req-1' })
    ).resolves.toBeUndefined();

    expect(repository.items).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith('Failed to persist audit log', {
      requestId: 'req-1',
      action: 'CREATE',
      entity: 'COMPANY',
      error: { name: 'AppError' },
    });
  });

  it('absorve falha de infraestrutura do repositório sem propagar erro', async () => {
    const logger = silentLogger();
    const repository = {
      create: vi.fn().mockRejectedValue(new Error('connection lost')),
      findByCompanyId: vi.fn(), findByUserId: vi.fn(),
    } as unknown as IAuditLogRepository;

    await expect(
      persistAuditBestEffort({ repository, logger, log: companyCreated() })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith('Failed to persist audit log', {
      action: 'CREATE', entity: 'COMPANY', error: { name: 'Error' },
    });
  });

  it('não registra nenhum valor do state na mensagem de erro', async () => {
    const logger = silentLogger();
    const invalid = forced({
      action: 'CREATE', entity: 'COMPANY', description: 'x',
      previousState: null, newState: { companyId: 'c', password: 'hunter2' },
    });

    await persistAuditBestEffort({ repository: new InMemoryAuditLogRepository(), logger, log: invalid });

    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('hunter2');
  });
});
