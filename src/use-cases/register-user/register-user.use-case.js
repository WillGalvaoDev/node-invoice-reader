import { AppError } from '../../errors/app-error.js';
export class RegisterUserUseCase {
    userRepository;
    hashProvider;
    constructor(userRepository, hashProvider) {
        this.userRepository = userRepository;
        this.hashProvider = hashProvider;
    }
    async execute({ name, email, password }) {
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
//# sourceMappingURL=register-user.use-case.js.map