import type { Request, Response } from 'express';
import { RegisterUserUseCase } from '../use-cases/register-user/register-user.use-case.js';

export class RegisterUserController {
  // Recebe o caso de uso injetado
  constructor(private registerUserUseCase: RegisterUserUseCase) {}

  async handle(req: Request, res: Response): Promise<Response> {
    const { name, email, password } = req.body;

    const user = await this.registerUserUseCase.execute({ name, email, password });

    return res.status(201).json({ status: 'success', data: user });
  }
}
