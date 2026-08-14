import { RegisterUserUseCase } from '../use-cases/register-user/register-user.use-case.js';
export class RegisterUserController {
    registerUserUseCase;
    // Recebe o caso de uso injetado
    constructor(registerUserUseCase) {
        this.registerUserUseCase = registerUserUseCase;
    }
    async handle(req, res) {
        const { name, email, password } = req.body;
        try {
            const user = await this.registerUserUseCase.execute({ name, email, password });
            return res.status(201).json(user);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'User already exists.') {
                return res.status(409).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Internal server error.' });
        }
    }
}
//# sourceMappingURL=register-user.controller.js.map