import type { Request, Response } from 'express';
import type { CreateCompanyUseCase } from '../use-cases/create-company/create-company.use-case.js';
import { AppError } from '../errors/app-error.js';

export class CreateCompanyController {
  constructor(private createCompanyUseCase: CreateCompanyUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    const ownerId = request.user?.id;

    if (!ownerId) {
      throw new AppError('Usuário não autenticado.', 401);
    }

    const { name, cnpj } = request.body;

    const result = await this.createCompanyUseCase.execute({
      name,
      cnpj,
      ownerId,
    });

    return response.status(201).json({
      status: 'success',
      data: result,
    });
  }
}