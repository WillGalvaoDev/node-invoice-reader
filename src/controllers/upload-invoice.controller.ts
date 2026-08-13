// src/controllers/upload-invoice.controller.ts
import type { Request, Response } from 'express';
import { ReadInvoiceUseCase } from '../use-cases/read-invoice/read-invoice.use-case.js';
import { AppError } from '../errors/app-error.js';
import type { IStorageProvider } from '../providers/storage.provider.js';
import { isDanfeMimeType } from '../config/upload.js';

export class UploadInvoiceController {
  constructor(
    private readInvoiceUseCase: ReadInvoiceUseCase,
    private storageProvider: IStorageProvider,
  ) {}

  async handle(request: Request, response: Response): Promise<Response> {
    // 1. Valida se o arquivo veio na requisição
    if (!request.file) {
      throw new AppError('Arquivo da nota fiscal é obrigatório.', 400);
    }

    // 2. Valida se o ID do estoque veio no body da requisição
    const { stockId, companyId } = request.body;

    if (!stockId) {
      await this.storageProvider.deleteFile(request.file.path);
      throw new AppError('ID do estoque (stockId) é obrigatório.', 400);
    }

    const filePath = request.file.path;
    const mimeType = request.file.mimetype;

    if (!isDanfeMimeType(mimeType)) {
      await this.storageProvider.deleteFile(filePath);
      throw new AppError('Tipo de arquivo não suportado.', 415);
    }
    const userId = request.user?.id;

    // 3. Executa o Use Case
    const { extractedData, processedProducts, suggestions } = await this.readInvoiceUseCase.execute({
      filePath,
      mimeType,
      stockId,
      userId,
      companyId,
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
