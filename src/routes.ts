import { Router } from 'express';
import multer from 'multer';
import { RegisterUserController } from './controllers/register-user.controller.js';
import { UploadInvoiceController } from './controllers/upload-invoice.controller.js';
import { ReadInvoiceUseCase } from './use-cases/read-invoice/read-invoice.use-case.js';
import { PrismaProductRepository } from './repositories/prisma-product.repository.js';
import { DiskStorageProvider } from './providers/implementations/disk-storage.provider.js';
import { GeminiAiProvider } from './providers/gemini-ai.provider.js';

import { RegisterUserUseCase } from './use-cases/register-user/register-user.use-case.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { Argon2HashProvider } from './providers/implementations/argon2-hash.provider.js';

// NOVOS IMPORTS PARA O FLUXO DE LOGIN
import { LoginUseCase } from './use-cases/login/login.use-case.js';
import { LoginController } from './controllers/login.controller.js';
import { JoseTokenProvider } from './providers/implementations/jose-token.provider.js';

export const routes = Router();

const upload = multer({ dest: 'tmp/' });

// Injeção - Notas Fiscais
const storageProvider = new DiskStorageProvider();
const aiProvider = new GeminiAiProvider();
const productRepository = new PrismaProductRepository();
const readInvoiceUseCase = new ReadInvoiceUseCase(storageProvider, aiProvider, productRepository);
const uploadInvoiceController = new UploadInvoiceController(readInvoiceUseCase);

// Compartilhado - Usuários (Instanciados uma vez para ambos os casos de uso)
const userRepository = new PrismaUserRepository();
const hashProvider = new Argon2HashProvider();

// Injeção - Cadastro
const registerUserUseCase = new RegisterUserUseCase(userRepository, hashProvider);
const registerUserController = new RegisterUserController(registerUserUseCase);

// INJEÇÃO - LOGIN (Padrão Sênior)
const tokenProvider = new JoseTokenProvider(); // Injetando o JWT com 'jose'
const loginUseCase = new LoginUseCase(userRepository, hashProvider, tokenProvider);
const loginController = new LoginController(loginUseCase);


// ROTAS
routes.post('/invoices/upload', upload.single('file'), (req, res) => {
  uploadInvoiceController.handle(req, res);
});

routes.post('/users', (req, res) => {
  registerUserController.handle(req, res);
});

// NOVA ROTA DE LOGIN
routes.post('/login', (req, res) => {
  loginController.handle(req, res);
});