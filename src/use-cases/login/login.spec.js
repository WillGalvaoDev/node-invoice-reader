import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginUseCase } from './login.use-case.js';
// Reutilizando/Criando Mocks rápidos para o ambiente isolado
class InMemoryUserRepository {
    items = [];
    async create(user) {
        const newUser = { id: 'user-1', email: user.email, name: user.name };
        this.items.push({ ...newUser, password: user.password });
        return newUser;
    }
    async findByEmail(email) {
        return this.items.find(item => item.email === email) || null;
    }
    async findById(id) {
        return this.items.find(item => item.id === id) || null;
    }
}
class FakeHashProvider {
    async generateHash(payload) { return `${payload}-hashed`; }
    async compareHash(payload, hashed) {
        return `${payload}-hashed` === hashed;
    }
}
class FakeTokenProvider {
    async generateToken(payload) {
        return `mocked-jwt-token-for-${payload.sub}`;
    }
    async verifyToken(token) {
        return { sub: 'user-1', email: 'john@example.com' };
    }
}
describe('Login Use Case', () => {
    let userRepository;
    let hashProvider;
    let tokenProvider;
    let sut;
    beforeEach(async () => {
        userRepository = new InMemoryUserRepository();
        hashProvider = new FakeHashProvider();
        tokenProvider = new FakeTokenProvider();
        sut = new LoginUseCase(userRepository, hashProvider, tokenProvider);
        // Criamos um usuário prévio no "banco" para podermos tentar logar com ele
        await userRepository.create({
            name: 'John Doe',
            email: 'john@example.com',
            password: 'password123-hashed', // Já simulando salvo com hash
        });
    });
    it('should be able to authenticate an existing user and return a token', async () => {
        const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const response = await sut.execute({
            email: 'john@example.com',
            password: 'password123',
        });
        expect(response.token).toBeDefined();
        expect(response.token).toContain('mocked-jwt-token-for-user-1');
        const logged = JSON.stringify(consoleLog.mock.calls);
        expect(logged).not.toContain('password123');
        expect(logged).not.toContain('john@example.com');
        expect(consoleLog).not.toHaveBeenCalled();
        consoleLog.mockRestore();
    });
    it('should not be able to authenticate with wrong password', async () => {
        await expect(sut.execute({
            email: 'john@example.com',
            password: 'wrong-password',
        })).rejects.toBeInstanceOf(Error);
    });
});
//# sourceMappingURL=login.spec.js.map