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

    // 2. Valida se o ID do estoque veio no body da requisição
    const { stockId } = request.body;

    if (!stockId) {
      throw new AppError('ID do estoque (stockId) é obrigatório.', 400);
    }

    const filePath = request.file.path;
    // Pega o ID do usuário injetado pelo middleware ensureAuthenticated
    const userId = request.user?.id;

    // 3. Executa o Use Case (Gemini OCR + Upsert por código + Sugestão por IA + Limpeza de arquivo)
    const { extractedData, processedProducts, suggestions } = await this.readInvoiceUseCase.execute({
      filePath,
      stockId,
      userId,
    });

    // 4. Retorna no padrão limpo e consistente da API
    return response.status(201).json({
      status: 'success',
      message: 'DANFE processado e produtos analisados com sucesso!',
      data: {
        invoice: extractedData,
        processedProducts,
        suggestions,
      },
    });
  }
}