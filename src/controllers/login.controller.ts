import type { Request, Response } from 'express';
import { LoginUseCase } from '../use-cases/login/login.use-case.js';

export class LoginController {
  constructor(private loginUseCase: LoginUseCase) {}

  async handle(req: Request, res: Response): Promise<Response> {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password.' });
    }

    try {
      const { token } = await this.loginUseCase.execute({ email, password });
      return res.status(200).json({ token });
    } catch (error: any) {
      // Retorna 401 Unauthorized para erros de credenciais inválidas
      if (error.message === 'Invalid email or password.') {
        return res.status(401).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
}