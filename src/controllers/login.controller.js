import { LoginUseCase } from '../use-cases/login/login.use-case.js';
export class LoginController {
    loginUseCase;
    constructor(loginUseCase) {
        this.loginUseCase = loginUseCase;
    }
    async handle(req, res) {
        const { email, password } = req.body;
        const { token } = await this.loginUseCase.execute({ email, password });
        return res.status(200).json({ status: 'success', data: { token } });
    }
}
//# sourceMappingURL=login.controller.js.map