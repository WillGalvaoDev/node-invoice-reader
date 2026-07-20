import type { IUserRepository } from '../../repositories/user.repository.js';
import type { IHashProvider } from '../../providers/hash.provider.js';
import type { ITokenProvider } from '../../providers/token.provider.js';

interface ILoginRequest {
  email: string;
  password: string;
}

interface ILoginResponse {
  token: string;
}

export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private hashProvider: IHashProvider,
    private tokenProvider: ITokenProvider
  ) {}

  async execute({ email, password }: ILoginRequest): Promise<ILoginResponse> {
    // 1. Busca o usuário pelo e-mail
    const user = await this.userRepository.findByEmail(email);

    // Mensagem genérica por segurança para evitar enumeração de contas
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // 2. Compara se o hash da senha confere (Protegendo a senha real)
    // Tratamos a possibilidade de a propriedade password não vir na interface básica
    const isPasswordValid = await this.hashProvider.compareHash(
      password,
      user.password ?? ''
    );

    if (!isPasswordValid) {
      throw new Error('Invalid email or password.');
    }

    // 3. Gera o token JWT abstraído
    const token = await this.tokenProvider.generateToken({
      sub: user.id ?? '',
      email: user.email,
    });

    return { token };
  }
}