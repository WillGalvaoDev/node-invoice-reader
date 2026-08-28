import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordUseCase } from './change-password.use-case.js';
import { InMemoryUserRepository } from '../../repositories/in-memory/in-memory-user.repository.js';
import { InMemoryAuditLogRepository } from '../../repositories/in-memory/in-memory-audit-log.repository.js';
import { AppError } from '../../errors/app-error.js';
class FakeHashProvider {
    async generateHash(payload) { return `${payload}-hashed`; }
    async compareHash(payload, hashed) {
        return `${payload}-hashed` === hashed;
    }
}
describe('ChangePasswordUseCase', () => {
    let userRepository;
    let auditLogRepository;
    let hashProvider;
    let sut;
    let userId;
    beforeEach(async () => {
        userRepository = new InMemoryUserRepository();
        auditLogRepository = new InMemoryAuditLogRepository();
        hashProvider = new FakeHashProvider();
        sut = new ChangePasswordUseCase(userRepository, hashProvider, auditLogRepository);
        const created = await userRepository.create({
            name: 'User', email: 'user@test.local', password: 'current-password-hashed',
        });
        userId = created.id;
    });
    it('troca a senha, persiste o novo hash e incrementa authVersion atomicamente', async () => {
        await sut.execute({ userId, currentPassword: 'current-password', newPassword: 'new-password' });
        const stored = userRepository.items.find((item) => item.id === userId);
        expect(stored?.password).toBe('new-password-hashed');
        expect(stored?.authVersion).toBe(2);
    });
    it('recusa com 401 quando a senha atual está incorreta, sem alterar estado', async () => {
        await expect(sut.execute({ userId, currentPassword: 'wrong-password', newPassword: 'new-password' })).rejects.toMatchObject({ name: 'AppError', statusCode: 401 });
        const stored = userRepository.items.find((item) => item.id === userId);
        expect(stored?.password).toBe('current-password-hashed');
        expect(stored?.authVersion).toBe(1);
    });
    it('recusa com 400 quando a nova senha é igual à atual', async () => {
        await expect(sut.execute({ userId, currentPassword: 'current-password', newPassword: 'current-password' })).rejects.toMatchObject({ name: 'AppError', statusCode: 400 });
        const stored = userRepository.items.find((item) => item.id === userId);
        expect(stored?.authVersion).toBe(1);
    });
    it('recusa com 401 quando o usuário não existe', async () => {
        await expect(sut.execute({ userId: 'no-such-user', currentPassword: 'x', newPassword: 'y' })).rejects.toMatchObject({ name: 'AppError', statusCode: 401 });
    });
    it('registra evento de auditoria só com authVersion, sem nenhum material de senha', async () => {
        await sut.execute({ userId, currentPassword: 'current-password', newPassword: 'new-password' });
        expect(auditLogRepository.items).toHaveLength(1);
        const event = auditLogRepository.items[0];
        expect(event).toMatchObject({
            action: 'UPDATE', entity: 'USER', userId,
            previousState: { authVersion: 1 },
            newState: { authVersion: 2 },
        });
        expect(JSON.stringify(event)).not.toContain('current-password');
        expect(JSON.stringify(event)).not.toContain('new-password');
    });
    it('falha de escrita do AuditLog não reverte a troca de senha (best-effort)', async () => {
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const failingAuditLogRepository = {
            create: vi.fn().mockRejectedValue(new Error('db unavailable')),
            findByCompanyId: vi.fn(), findByUserId: vi.fn(),
        };
        const sutWithFailingAudit = new ChangePasswordUseCase(userRepository, hashProvider, failingAuditLogRepository, logger);
        await expect(sutWithFailingAudit.execute({ userId, currentPassword: 'current-password', newPassword: 'new-password' })).resolves.toBeUndefined();
        const stored = userRepository.items.find((item) => item.id === userId);
        expect(stored?.password).toBe('new-password-hashed');
        expect(stored?.authVersion).toBe(2);
        expect(logger.error).toHaveBeenCalledOnce();
    });
    it('não lança AppError não tratado ao propagar erro de senha incorreta (mensagem genérica)', async () => {
        try {
            await sut.execute({ userId, currentPassword: 'wrong', newPassword: 'new-password' });
            expect.unreachable();
        }
        catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect(error.message).not.toContain('wrong');
        }
    });
});
//# sourceMappingURL=change-password.use-case.spec.js.map