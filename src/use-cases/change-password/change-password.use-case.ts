import type { IUserRepository } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import { AppError } from '../../errors/app-error.js';
import { logger, type Logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { auditEvents } from '../audit-events.js';

interface IChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
  requestId?: string | undefined;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashProvider: IHashProvider,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly applicationLogger: Logger = logger,
  ) {}

  async execute({ userId, currentPassword, newPassword, requestId }: IChangePasswordRequest): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado.', 401);
    }

    const isCurrentPasswordValid = await this.hashProvider.compareHash(currentPassword, user.password ?? '');
    if (!isCurrentPasswordValid) {
      throw new AppError('Senha atual incorreta.', 401);
    }

    const isSamePassword = await this.hashProvider.compareHash(newPassword, user.password ?? '');
    if (isSamePassword) {
      throw new AppError('A nova senha deve ser diferente da senha atual.', 400);
    }

    const previousAuthVersion = user.authVersion ?? 1;
    const newPasswordHash = await this.hashProvider.generateHash(newPassword);
    const updated = await this.userRepository.updatePassword(userId, newPasswordHash);

    await persistAuditBestEffort({
      repository: this.auditLogRepository,
      logger: this.applicationLogger,
      requestId,
      log: auditEvents.userPasswordChanged({
        userId,
        previousAuthVersion,
        newAuthVersion: updated.authVersion ?? previousAuthVersion + 1,
      }),
    });
  }
}
