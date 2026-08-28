import { AppError } from '../errors/app-error.js';
export class ChangePasswordController {
    changePasswordUseCase;
    constructor(changePasswordUseCase) {
        this.changePasswordUseCase = changePasswordUseCase;
    }
    async handle(request, response) {
        const userId = request.user?.id;
        if (!userId) {
            throw new AppError('Usuário não autenticado.', 401);
        }
        const { currentPassword, newPassword } = request.body;
        await this.changePasswordUseCase.execute({
            userId,
            currentPassword,
            newPassword,
            requestId: request.requestId,
        });
        return response.status(204).send();
    }
}
//# sourceMappingURL=change-password.controller.js.map