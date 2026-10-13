import { AppError } from '../../errors/app-error.js';
import type { IDemoSession, IDemoSessionRepository } from '../../repositories/demo-session.repository.js';

export class GetCurrentDemoSessionUseCase {
  constructor(private readonly sessions: IDemoSessionRepository) {}

  async execute({ userId }: { userId: string }): Promise<IDemoSession> {
    const session = await this.sessions.findActiveByOwner(userId);
    if (!session) throw new AppError('Nenhuma sessão de demonstração ativa.', 404);
    return session;
  }
}
