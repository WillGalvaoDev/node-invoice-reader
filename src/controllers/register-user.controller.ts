import type { Request, Response } from 'express';
import { RegisterUserUseCase } from '../use-cases/register-user/register-user.use-case.js';

export class RegisterUserController {
  // Recebe o caso de uso injetado
  constructor(private registerUserUseCase: RegisterUserUseCase) {}

  async handle(req: Request, res: Response): Promise<Response> {
    const { name, email, password } = req.body;

    try {
      const user = await this.registerUserUseCase.execute({ name, email, password });
      return res.status(201).json(user);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'User already exists.') {
        return res.status(409).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
}
