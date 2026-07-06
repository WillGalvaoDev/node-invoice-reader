import type { Request, Response } from 'express';
import { ReadInvoiceUseCase } from '../use-cases/read-invoice/read-invoice.use-case.js';
import multer from 'multer';

export class UploadInvoiceController {
  constructor(private readInvoiceUseCase: ReadInvoiceUseCase) {}

  async handle(request: Request, response: Response): Promise<Response> {
    try {
      // O Multer joga o arquivo injetado dentro de request.file
      if (!request.file) {
        return response.status(400).json({ error: 'Arquivo da nota fiscal é obrigatório.' });
      }

      // Caminho temporário onde o Multer salvou o arquivo
      const filePath = request.file.path;

      // Executa o seu pipeline sênior (Gemini + Prisma)
      // Passamos o userId como undefined por enquanto até termos o Auth pronto
      const result = await this.readInvoiceUseCase.execute({
        filePath,
        userId: undefined 
      });

      return response.status(201).json({
        message: 'DANFE processado e estoque atualizado com sucesso!',
        data: result
      });
    } catch (error: any) {
      console.error('❌ Erro no UploadInvoiceController:', error);
      return response.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
}