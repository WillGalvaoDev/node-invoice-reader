import type { IUserRepository, IUser } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';

interface IRegisterUserRequest {
  name: string;
  email: string;
  password: string;
}

export class RegisterUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private hashProvider: IHashProvider
  ) {}

  async execute({ name, email, password }: IRegisterUserRequest): Promise<IUser> {
    // 1. Regra de negócio: impede emails duplicados
    const userAlreadyExists = await this.userRepository.findByEmail(email);
    
    if (userAlreadyExists) {
      throw new Error('User already exists.');
    }

    // 2. Criptografa a senha usando o abstraído Argon2
    const hashedPassword = await this.hashProvider.generateHash(password);

    // 3. Persiste o usuário tratado no banco
    const user = await this.userRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    return user;
  }
}