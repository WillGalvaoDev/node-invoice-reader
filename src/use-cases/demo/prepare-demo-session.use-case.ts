import { randomUUID } from 'node:crypto';
import type { DemoIdentityFactory, IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
import { deriveDemoAccessKey } from '../../demo/demo-scenario.js';
import { generateSyntheticCnpj } from '../../demo/synthetic-cnpj.js';

/** Nova identidade sintética a cada chamada: ID, CNPJ e chaves não se repetem. */
export const newDemoIdentity: DemoIdentityFactory = () => {
  const sessionId = randomUUID();
  return {
    sessionId,
    cnpj: generateSyntheticCnpj(),
    accessKeys: {
      initial: deriveDemoAccessKey(sessionId, 'initial'),
      followup: deriveDemoAccessKey(sessionId, 'followup'),
    },
  };
};

export class PrepareDemoSessionUseCase {
  constructor(
    private readonly sessions: IDemoSessionRepository,
    private readonly identity: DemoIdentityFactory = newDemoIdentity,
  ) {}

  /** Não chama IA nem insere produtos: o estoque só muda por upload e decisão reais. */
  async execute({ userId }: { userId: string }): Promise<{ session: IDemoSession; created: boolean }> {
    return this.sessions.createForOwner(userId, this.identity);
  }
}
