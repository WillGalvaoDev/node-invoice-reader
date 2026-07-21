import type { Request, Response } from 'express';
import type { ReadInvoiceUseCase } from '../use-cases/read-invoice/read-invoice.use-case.js';
import { AppError } from '../errors/app-error.js';

export class UploadInvoiceController {
  constructor(private readInvoiceUseCase: ReadInvoiceUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    // 1. Valida se o arquivo veio na requisição
    if (!request.file) {
      throw new AppError('Arquivo da nota fiscal é obrigatório.', 400);
    }

    const filePath = request.file.path;
    // Pega o ID do usuário injetado pelo middleware ensureAuthenticated
    const userId = request.user?.id;

    // 2. Executa o Use Case (Gemini + Prisma + Limpeza de arquivo)
    const result = await this.readInvoiceUseCase.execute({
      filePath,
      userId,
    });

    // 3. Desestruturamos para separar 'products' dos dados gerais da nota
    const { products, ...invoice } = result;

    // 4. Retorna no padrão limpo e consistente da API
    return response.status(201).json({
      status: 'success',
      message: 'DANFE processado e produtos salvos com sucesso!',
      data: {
        invoice,
        products,
      },
    });
  }
}