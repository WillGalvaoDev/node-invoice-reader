// src/controllers/upload-invoice.controller.ts
import type { Request, Response } from 'express';
import { ReadInvoiceUseCase } from '../use-cases/read-invoice/read-invoice.use-case.js';
import { AppError } from '../errors/app-error.js';
import type { IStorageProvider } from '../providers/storage.provider.js';
import { isDanfeMimeType } from '../config/upload.js';
import { uploadInvoiceBodySchema } from '../schemas/http.schemas.js';

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

    // O multipart já criou o temporário; valide antes do caso de uso e limpe em falha.
    const body = uploadInvoiceBodySchema.safeParse(request.body);
    if (!body.success) {
      await this.storageProvider.deleteFile(request.file.path);
      throw new AppError('Dados inválidos.', 400);
    }
    const { stockId } = body.data;

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
      requestId: request.requestId,
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
