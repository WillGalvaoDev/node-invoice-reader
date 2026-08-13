export class LoginUseCase {
    userRepository;
    hashProvider;
    tokenProvider;
    constructor(userRepository, hashProvider, tokenProvider) {
        this.userRepository = userRepository;
        this.hashProvider = hashProvider;
        this.tokenProvider = tokenProvider;
    }
    async execute({ email, password }) {
        // 1. Busca o usuário pelo e-mail
        const user = await this.userRepository.findByEmail(email);
        // Mensagem genérica por segurança para evitar enumeração de contas
        if (!user) {
            throw new Error('Invalid email or password.');
        }
        // 2. Compara se o hash da senha confere (Protegendo a senha real)
        // Tratamos a possibilidade de a propriedade password não vir na interface básica
        const isPasswordValid = await this.hashProvider.compareHash(password, user.password ?? '');
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
//# sourceMappingURL=login.use-case.js.map