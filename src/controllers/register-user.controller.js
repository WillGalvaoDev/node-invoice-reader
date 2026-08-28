import { RegisterUserUseCase } from '../use-cases/register-user/register-user.use-case.js';
export class RegisterUserController {
    registerUserUseCase;
    // Recebe o caso de uso injetado
    constructor(registerUserUseCase) {
        this.registerUserUseCase = registerUserUseCase;
    }
    async handle(req, res) {
        const { name, email, password, inviteCode } = req.body;
        const user = await this.registerUserUseCase.execute({
            name, email, password, ...(inviteCode !== undefined && { inviteCode }),
        });
        return res.status(201).json({ status: 'success', data: user });
    }
}
//# sourceMappingURL=register-user.controller.js.map