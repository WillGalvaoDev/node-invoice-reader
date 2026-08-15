import type { Request, Response } from 'express';
import { LoginUseCase } from '../use-cases/login/login.use-case.js';

export class LoginController {
  constructor(private loginUseCase: LoginUseCase) {}

  async handle(req: Request, res: Response): Promise<Response> {
    const { email, password } = req.body;

    const { token } = await this.loginUseCase.execute({ email, password });

    return res.status(200).json({ status: 'success', data: { token } });
  }
}
