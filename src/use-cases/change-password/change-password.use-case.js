import { AppError } from '../../errors/app-error.js';
import { logger } from '../../infra/logger.js';
import { persistAuditBestEffort } from '../best-effort-audit.js';
import { auditEvents } from '../audit-events.js';
export class ChangePasswordUseCase {
    userRepository;
    hashProvider;
    auditLogRepository;
    applicationLogger;
    constructor(userRepository, hashProvider, auditLogRepository, applicationLogger = logger) {
        this.userRepository = userRepository;
        this.hashProvider = hashProvider;
        this.auditLogRepository = auditLogRepository;
        this.applicationLogger = applicationLogger;
    }
    async execute({ userId, currentPassword, newPassword, requestId }) {
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
//# sourceMappingURL=change-password.use-case.js.map