import type { IUserRepository } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import type { IAuditLogRepository } from '../../repositories/audit-log.repository.js';
import { type Logger } from '../../infra/logger.js';
interface IChangePasswordRequest {
    userId: string;
    currentPassword: string;
    newPassword: string;
    requestId?: string | undefined;
}
export declare class ChangePasswordUseCase {
    private readonly userRepository;
    private readonly hashProvider;
    private readonly auditLogRepository;
    private readonly applicationLogger;
    constructor(userRepository: IUserRepository, hashProvider: IHashProvider, auditLogRepository: IAuditLogRepository, applicationLogger?: Logger);
    execute({ userId, currentPassword, newPassword, requestId }: IChangePasswordRequest): Promise<void>;
}
export {};
//# sourceMappingURL=change-password.use-case.d.ts.map