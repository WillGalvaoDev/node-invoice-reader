import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginUseCase } from './login.use-case.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import type { ITokenProvider, ITokenPayload } from '../../providers/token.provider.js';
import { AppError } from '../../errors/app-error.js';
import { InMemoryUserRepository } from '../../repositories/in-memory/in-memory-user.repository.js';

class FakeHashProvider implements IHashProvider {
  async generateHash(payload: string): Promise<string> { return `${payload}-hashed`; }
  async compareHash(payload: string, hashed: string): Promise<boolean> {
    return `${payload}-hashed` === hashed;
  }
}

class FakeTokenProvider implements ITokenProvider {
  async generateToken(payload: ITokenPayload): Promise<string> {
    return `mocked-jwt-token-for-${payload.sub}`;
  }
  async verifyToken(_token: string): Promise<ITokenPayload | null> {
    return { sub: 'user-1', email: 'john@example.com' };
  }
}

describe('Login Use Case', () => {
  let userRepository: InMemoryUserRepository;
  let hashProvider: FakeHashProvider;
  let tokenProvider: FakeTokenProvider;
  let sut: LoginUseCase;

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
    await expect(
      sut.execute({
        email: 'john@example.com',
        password: 'wrong-password',
      })
    ).rejects.toMatchObject({ name: 'AppError', statusCode: 401 });
  });

  it('não deve ser possível autenticar com e-mail inexistente', async () => {
    await expect(
      sut.execute({
        email: 'unknown@example.com',
        password: 'password123',
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('suporta múltiplos usuários com identidades distintas (dublê compartilhado, sem ID fixo)', async () => {
    await userRepository.create({ name: 'Jane Doe', email: 'jane@example.com', password: 'jane-secret-hashed' });

    const janeResponse = await sut.execute({ email: 'jane@example.com', password: 'jane-secret' });

    expect(janeResponse.token).toContain('mocked-jwt-token-for-user-2');
    expect(janeResponse.token).not.toContain('user-1');
  });
});
