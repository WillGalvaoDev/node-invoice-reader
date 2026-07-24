import { Router } from 'express';
import { ensureAuthenticated } from './middlewares/ensure-authenticated.js';
import multer from 'multer';
import { RegisterUserController } from './controllers/register-user.controller.js';
import { UploadInvoiceController } from './controllers/upload-invoice.controller.js';
import { ReadInvoiceUseCase } from './use-cases/read-invoice/read-invoice.use-case.js';
import { PrismaProductRepository } from './repositories/prisma-product.repository.js';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository.js';
import { DiskStorageProvider } from './providers/implementations/disk-storage.provider.js';
import { GeminiAiProvider } from './providers/gemini-ai.provider.js';

import { RegisterUserUseCase } from './use-cases/register-user/register-user.use-case.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { Argon2HashProvider } from './providers/implementations/argon2-hash.provider.js';

// LOGIN
import { LoginUseCase } from './use-cases/login/login.use-case.js';
import { LoginController } from './controllers/login.controller.js';
import { JoseTokenProvider } from './providers/implementations/jose-token.provider.js';

// PRODUTOS
import { ListProductsUseCase } from './use-cases/list-products/list-products.use-case.js';
import { ListProductsController } from './controllers/list-products.controller.js';

// EMPRESAS (NOVO)
import { CreateCompanyUseCase } from './use-cases/create-company/create-company.use-case.js';
import { CreateCompanyController } from './controllers/create-company.controller.js';
import { PrismaCompanyRepository } from './repositories/prisma-company.repository.js';
import { PrismaStockRepository } from './repositories/prisma-stock.repository.js';

export const routes = Router();

const upload = multer({ dest: 'tmp/' });

// Injeção - Notas Fiscais e Auditoria
const storageProvider = new DiskStorageProvider();
const aiProvider = new GeminiAiProvider();
const productRepository = new PrismaProductRepository();
const auditLogRepository = new PrismaAuditLogRepository();

const readInvoiceUseCase = new ReadInvoiceUseCase(
  storageProvider, 
  aiProvider, 
  productRepository, 
  auditLogRepository
);

const uploadInvoiceController = new UploadInvoiceController(readInvoiceUseCase);
const listProductsUseCase = new ListProductsUseCase(productRepository);
const listProductsController = new ListProductsController(listProductsUseCase);

// Compartilhado - Usuários
const userRepository = new PrismaUserRepository();
const hashProvider = new Argon2HashProvider();

// Injeção - Cadastro
const registerUserUseCase = new RegisterUserUseCase(userRepository, hashProvider);
const registerUserController = new RegisterUserController(registerUserUseCase);

// INJEÇÃO - LOGIN
const tokenProvider = new JoseTokenProvider();
const loginUseCase = new LoginUseCase(userRepository, hashProvider, tokenProvider);
const loginController = new LoginController(loginUseCase);

// INJEÇÃO - EMPRESA (NOVO)
const companyRepository = new PrismaCompanyRepository();
const stockRepository = new PrismaStockRepository();

const createCompanyUseCase = new CreateCompanyUseCase(
  companyRepository,
  stockRepository,
  auditLogRepository
);
const createCompanyController = new CreateCompanyController(createCompanyUseCase);


// ROTAS
routes.post(
  '/invoices/upload', 
  upload.single('file'), 
  ensureAuthenticated, 
  uploadInvoiceController.handle.bind(uploadInvoiceController)
);

routes.post('/users', (req, res) => {
  registerUserController.handle(req, res);
});

// ROTA DE LOGIN
routes.post('/login', (req, res) => {
  loginController.handle(req, res);
});

routes.get('/products', ensureAuthenticated, (req, res) => {
  listProductsController.handle(req, res);
});

// NOVA ROTA DE CRIAÇÃO DE EMPRESA
routes.post('/companies', ensureAuthenticated, (req, res) => {
  createCompanyController.handle(req, res);
});