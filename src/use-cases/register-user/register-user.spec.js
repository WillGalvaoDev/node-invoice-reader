import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegisterUserUseCase } from './register-user.use-case.js';
import { InMemoryUserRepository } from '../../repositories/in-memory/in-memory-user.repository.js';
// 2. Mock do Provedor de Hash (Evita processar criptografia real nos testes unitários)
class FakeHashProvider {
    async generateHash(payload) {
        return `${payload}-hashed`;
    }
    async compareHash(payload, hashed) {
        return `${payload}-hashed` === hashed;
    }
}
// 3. A Suíte de Testes
describe('Register User Use Case', () => {
    let userRepository;
    let hashProvider;
    let sut; // SUT = System Under Test
    beforeEach(() => {
        userRepository = new InMemoryUserRepository();
        hashProvider = new FakeHashProvider();
        // Aqui injetamos os mocks na nossa classe alvo
        sut = new RegisterUserUseCase(userRepository, hashProvider);
    });
    it('should be able to register a new user with a hashed password', async () => {
        const consoleMethods = [
            vi.spyOn(console, 'log').mockImplementation(() => undefined),
            vi.spyOn(console, 'error').mockImplementation(() => undefined),
            vi.spyOn(console, 'warn').mockImplementation(() => undefined),
            vi.spyOn(console, 'info').mockImplementation(() => undefined),
        ];
        const user = await sut.execute({
            name: 'John Doe',
            email: 'johndoe@example.com',
            password: 'password123'
        });
        expect(user.id).toBeDefined();
        expect(user.email).toBe('johndoe@example.com');
        // Validando no banco em memória se a senha foi salva CRIPTOGRAFADA
        const savedUser = userRepository.items[0];
        expect(savedUser?.password).toBe('password123-hashed');
        expect(consoleMethods.every((method) => method.mock.calls.length === 0)).toBe(true);
        for (const method of consoleMethods)
            method.mockRestore();
    });
    it('should not be able to register a user with an existing email', async () => {
        // Cadastra o primeiro
        await sut.execute({
            name: 'John Doe',
            email: 'duplicate@example.com',
            password: 'password123'
        });
        // Tenta cadastrar o segundo com o mesmo email e espera falhar
        await expect(sut.execute({
            name: 'Jane Doe',
            email: 'duplicate@example.com',
            password: 'password123'
        })).rejects.toMatchObject({ name: 'AppError', statusCode: 409 });
    });
    it('atribui IDs distintos a usuários distintos (dublê compartilhado, sem ID fixo)', async () => {
        const first = await sut.execute({ name: 'John Doe', email: 'john@example.com', password: 'password123' });
        const second = await sut.execute({ name: 'Jane Doe', email: 'jane@example.com', password: 'password123' });
        expect(first.id).not.toBe(second.id);
        expect(userRepository.items).toHaveLength(2);
    });
});
//# sourceMappingURL=register-user.spec.js.map