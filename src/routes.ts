import { Router } from 'express';
import multer from 'multer';
import { UploadInvoiceController } from './controllers/upload-invoice.controller.js';
import { ReadInvoiceUseCase } from './use-cases/read-invoice/read-invoice.use-case.js';
import { PrismaProductRepository } from './repositories/prisma-product.repository.js';
import { DiskStorageProvider } from './providers/implementations/disk-storage.provider.js';
import { GeminiAiProvider } from './providers/gemini-ai.provider.js';

export const routes = Router();

// Configura o Multer para salvar os uploads temporariamente na pasta 'tmp'
const upload = multer({ dest: 'tmp/' });

// Injeção de Dependências
const storageProvider = new DiskStorageProvider();
const aiProvider = new GeminiAiProvider();
const productRepository = new PrismaProductRepository();

const readInvoiceUseCase = new ReadInvoiceUseCase(
  storageProvider,
  aiProvider,
  productRepository
);

const uploadInvoiceController = new UploadInvoiceController(readInvoiceUseCase);

// Rota HTTP POST para upload da nota fiscal
routes.post('/invoices/upload', upload.single('file'), (req, res) => {
  uploadInvoiceController.handle(req, res);
});