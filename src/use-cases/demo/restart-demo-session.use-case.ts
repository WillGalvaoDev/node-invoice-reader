import { AppError } from '../../errors/app-error.js';
import type { DemoIdentityFactory, IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';
import { newDemoIdentity } from './prepare-demo-session.use-case.js';

export class RestartDemoSessionUseCase {
  constructor(
    private readonly sessions: IDemoSessionRepository,
    private readonly identity: DemoIdentityFactory = newDemoIdentity,
  ) {}

  async execute({ userId, sessionId }: { userId: string; sessionId: string }): Promise<IDemoSession> {
    const successor = await this.sessions.restart(sessionId, userId, this.identity);
    // Sessão alheia e inexistente produzem a mesma resposta (anti-enumeração).
    if (!successor) throw new AppError('Sessão de demonstração não encontrada.', 404);
    return successor;
  }
}
