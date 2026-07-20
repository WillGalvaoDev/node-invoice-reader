import { describe, it, expect, beforeEach } from 'vitest';
import { LoginUseCase } from './login.use-case.js';
import type { IUserRepository, IUser } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import type { ITokenProvider, ITokenPayload } from '../../providers/token.provider.js';

// Reutilizando/Criando Mocks rápidos para o ambiente isolado
class InMemoryUserRepository implements IUserRepository {
  public items: IUser[] = [];

  async create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser> {
    const newUser: IUser = { id: 'user-1', email: user.email, name: user.name };
    this.items.push({ ...newUser, password: user.password });
    return newUser;
  }
  async findByEmail(email: string): Promise<IUser | null> {
    return this.items.find(item => item.email === email) || null;
  }
  async findById(id: string): Promise<IUser | null> {
    return this.items.find(item => item.id === id) || null;
  }
}

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
  async verifyToken(token: string): Promise<ITokenPayload | null> {
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
    const response = await sut.execute({
      email: 'john@example.com',
      password: 'password123',
    });

    expect(response.token).toBeDefined();
    expect(response.token).toContain('mocked-jwt-token-for-user-1');
  });

  it('should not be able to authenticate with wrong password', async () => {
    await expect(
      sut.execute({
        email: 'john@example.com',
        password: 'wrong-password',
      })
    ).rejects.toBeInstanceOf(Error);
  });
});