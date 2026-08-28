import type { Request, Response } from 'express';
import type { ChangePasswordUseCase } from '../use-cases/change-password/change-password.use-case.js';
import { AppError } from '../errors/app-error.js';

export class ChangePasswordController {
  constructor(private changePasswordUseCase: ChangePasswordUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
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
