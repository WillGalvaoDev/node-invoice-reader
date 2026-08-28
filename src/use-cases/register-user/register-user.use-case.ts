import type { IUserRepository, IUser } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import { AppError } from '../../errors/app-error.js';
import { createHash, timingSafeEqual } from 'node:crypto';

interface IRegisterUserRequest {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
}

// Digest de tamanho fixo antes de comparar: timingSafeEqual exige buffers do
// mesmo tamanho e lançaria para strings de comprimentos diferentes — hashear
// primeiro elimina essa classe de exceção e não vaza o comprimento do valor recebido.
function inviteCodeDigest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export class RegisterUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private hashProvider: IHashProvider,
    private inviteCode: string,
  ) {}

  async execute({ name, email, password, inviteCode }: IRegisterUserRequest): Promise<IUser> {
    // Ausência e código incorreto convergem para a mesma recusa: nenhuma
    // distinção de mensagem, status ou tempo revela que existe uma política
    // de convite (P4-03).
    const isInviteCodeValid = timingSafeEqual(
      inviteCodeDigest(inviteCode ?? ''),
      inviteCodeDigest(this.inviteCode),
    );
    if (!isInviteCodeValid) {
      throw new AppError('Cadastro não permitido.', 403);
    }

    // 1. Regra de negócio: impede emails duplicados
    const userAlreadyExists = await this.userRepository.findByEmail(email);

    if (userAlreadyExists) {
      throw new AppError('Já existe um usuário cadastrado com este email.', 409);
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
