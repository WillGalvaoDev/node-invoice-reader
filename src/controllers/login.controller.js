import { LoginUseCase } from '../use-cases/login/login.use-case.js';
export class LoginController {
    loginUseCase;
    constructor(loginUseCase) {
        this.loginUseCase = loginUseCase;
    }
    async handle(req, res) {
        const { email, password } = req.body;
        try {
            const { token } = await this.loginUseCase.execute({ email, password });
            return res.status(200).json({ token });
        }
        catch (error) {
            // Retorna 401 Unauthorized para erros de credenciais inválidas
            if (error instanceof Error && error.message === 'Invalid email or password.') {
                return res.status(401).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Internal server error.' });
        }
    }
}
//# sourceMappingURL=login.controller.js.map