import type { DemoSession, Prisma } from '@prisma/client';
import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
import { DEFAULT_STOCK_NAME } from '../domain/default-stock-name.js';
import { DEMO_DOCUMENT_KINDS } from '../demo/demo-scenario.js';
import { createCompanyWithDefaultStockIn } from './prisma-company.repository.js';
import type {
  DemoIdentityFactory, IDemoIdentity, IDemoSession, IDemoSessionRepository,
} from './demo-session.repository.js';

const MAX_IDENTITY_ATTEMPTS = 5;

/** Chave de acesso candidata já pertence a uma nota processada: tratada como colisão. */
class DemoIdentityCollisionError extends Error {}

const unavailable = () =>
  new AppError('Não foi possível preparar o ambiente de demonstração agora. Tente novamente.', 503);

function toDomain(raw: DemoSession): IDemoSession {
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    companyId: raw.companyId,
    stockId: raw.stockId,
    state: raw.state,
    successorId: raw.successorId,
    createdAt: raw.createdAt,
    archivedAt: raw.archivedAt,
  };
}

async function insertSession(
  transaction: Prisma.TransactionClient,
  ownerId: string,
  identity: IDemoIdentity,
): Promise<DemoSession> {
  const keys = DEMO_DOCUMENT_KINDS.map((kind) => identity.accessKeys[kind]);
  const alreadyProcessed = await transaction.processedInvoice.findFirst({
    where: { accessKey: { in: keys } },
    select: { id: true },
  });
  if (alreadyProcessed) throw new DemoIdentityCollisionError();

  const { company, stock } = await createCompanyWithDefaultStockIn(
    transaction,
    { name: `Empresa Sintetica Demo ${identity.sessionId.slice(0, 8)}`, cnpj: identity.cnpj, ownerId },
    DEFAULT_STOCK_NAME,
  );
  if (!company.id || !stock.id) throw new Error('Empresa de demonstração criada sem identificadores.');

  const session = await transaction.demoSession.create({
    data: { id: identity.sessionId, ownerId, companyId: company.id, stockId: stock.id },
  });
  await transaction.demoDocumentKey.createMany({
    data: [
      { accessKey: identity.accessKeys.initial, sessionId: session.id, kind: 'INITIAL' },
      { accessKey: identity.accessKeys.followup, sessionId: session.id, kind: 'FOLLOWUP' },
    ],
  });
  return session;
}

export class PrismaDemoSessionRepository implements IDemoSessionRepository {
  async findActiveByOwner(ownerId: string): Promise<IDemoSession | null> {
    const session = await prisma.demoSession.findFirst({ where: { ownerId, state: 'ACTIVE' } });
    return session ? toDomain(session) : null;
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<IDemoSession | null> {
    const session = await prisma.demoSession.findFirst({ where: { id, ownerId } });
    return session ? toDomain(session) : null;
  }

  async createForOwner(
    ownerId: string,
    identity: DemoIdentityFactory,
  ): Promise<{ session: IDemoSession; created: boolean }> {
    for (let attempt = 0; attempt < MAX_IDENTITY_ATTEMPTS; attempt++) {
      try {
        return await prisma.$transaction(async (transaction) => {
          const active = await transaction.demoSession.findFirst({ where: { ownerId, state: 'ACTIVE' } });
          if (active) return { session: toDomain(active), created: false };
          return { session: toDomain(await insertSession(transaction, ownerId, identity())), created: true };
        });
      } catch (error) {
        if (error instanceof DemoIdentityCollisionError) continue;
        if (!isPrismaErrorCode(error, 'P2002')) throw error;

        // Perdeu a corrida pelo índice parcial (outra preparação venceu) ou colidiu CNPJ/chave.
        const winner = await this.findActiveByOwner(ownerId);
        if (winner) return { session: winner, created: false };
      }
    }
    throw unavailable();
  }

  async restart(
    sessionId: string,
    ownerId: string,
    identity: DemoIdentityFactory,
  ): Promise<IDemoSession | null> {
    for (let attempt = 0; attempt < MAX_IDENTITY_ATTEMPTS; attempt++) {
      try {
        return await prisma.$transaction(async (transaction) => {
          // Trava a sessão antiga: reinícios concorrentes do mesmo ID se serializam aqui.
          const locked = await transaction.$queryRaw<Array<{ state: string; successorId: string | null }>>`
            SELECT "state"::text AS "state", "successorId" FROM "demo_sessions"
            WHERE "id" = ${sessionId} AND "ownerId" = ${ownerId} FOR UPDATE`;
          const current = locked[0];
          if (!current) return null;

          if (current.state === 'ARCHIVED') {
            if (!current.successorId) return null;
            const successor = await transaction.demoSession.findUnique({ where: { id: current.successorId } });
            return successor ? toDomain(successor) : null;
          }

          await transaction.demoSession.update({
            where: { id: sessionId },
            data: { state: 'ARCHIVED', archivedAt: new Date() },
          });
          const created = await insertSession(transaction, ownerId, identity());
          await transaction.demoSession.update({ where: { id: sessionId }, data: { successorId: created.id } });
          return toDomain(created);
        });
      } catch (error) {
        if (error instanceof DemoIdentityCollisionError) continue;
        if (isPrismaErrorCode(error, 'P2002')) continue;
        throw error;
      }
    }
    throw unavailable();
  }
}
