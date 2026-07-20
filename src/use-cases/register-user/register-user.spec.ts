import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUserUseCase } from './register-user.use-case.js';
import type { IUserRepository, IUser } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';

// 1. Mock do Repositório em Memória
class InMemoryUserRepository implements IUserRepository {
  public items: IUser[] = [];

  async create(user: Omit<IUser, 'id' | 'createdAt'> & { password: string }): Promise<IUser> {
    const newUser: IUser = {
      id: 'user-id-mock',
      email: user.email,
      name: user.name,
      createdAt: new Date()
    };
    
    this.items.push({ ...newUser, password: user.password });
    return newUser;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const user = this.items.find(item => item.email === email);
    return user || null;
  }

  async findById(id: string): Promise<IUser | null> {
    const user = this.items.find(item => item.id === id);
    return user || null;
  }
}

// 2. Mock do Provedor de Hash (Evita processar criptografia real nos testes unitários)
class FakeHashProvider implements IHashProvider {
  async generateHash(payload: string): Promise<string> {
    return `${payload}-hashed`;
  }
  async compareHash(payload: string, hashed: string): Promise<boolean> {
    return `${payload}-hashed` === hashed;
  }
}

// 3. A Suíte de Testes
describe('Register User Use Case', () => {
  let userRepository: InMemoryUserRepository;
  let hashProvider: FakeHashProvider;
  let sut: RegisterUserUseCase; // SUT = System Under Test

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    hashProvider = new FakeHashProvider();
    // Aqui injetamos os mocks na nossa classe alvo
    sut = new RegisterUserUseCase(userRepository, hashProvider);
  });

  it('should be able to register a new user with a hashed password', async () => {
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
  });

  it('should not be able to register a user with an existing email', async () => {
    // Cadastra o primeiro
    await sut.execute({
      name: 'John Doe',
      email: 'duplicate@example.com',
      password: 'password123'
    });

    // Tenta cadastrar o segundo com o mesmo email e espera falhar
    await expect(
      sut.execute({
        name: 'Jane Doe',
        email: 'duplicate@example.com',
        password: 'password123'
      })
    ).rejects.toBeInstanceOf(Error);
  });
});