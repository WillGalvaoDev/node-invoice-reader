import { Router } from 'express';
import { ensureAuthenticated } from './middlewares/ensure-authenticated.js';
import { uploadRateLimiter } from './middlewares/upload-rate-limiter.js';
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

// EMPRESAS
import { CreateCompanyUseCase } from './use-cases/create-company/create-company.use-case.js';
import { CreateCompanyController } from './controllers/create-company.controller.js';
import { PrismaCompanyRepository } from './repositories/prisma-company.repository.js';
import { PrismaStockRepository } from './repositories/prisma-stock.repository.js';
import { PrismaInvoicePersistenceRepository } from './repositories/prisma-invoice-persistence.repository.js';
import { invoiceUpload } from './middlewares/invoice-upload.js';
import { loginRateLimiter, userRegistrationRateLimiter } from './middlewares/auth-rate-limiters.js';
import { validateBody, validateQuery } from './middlewares/validate-request.js';
import {
  createCompanyBodySchema,
  listProductsQuerySchema,
  loginBodySchema,
  registerUserBodySchema,
} from './schemas/http.schemas.js';

export const routes = Router();

// Injeção - Compartilhados / Repositórios
const storageProvider = new DiskStorageProvider();
const aiProvider = new GeminiAiProvider();
const productRepository = new PrismaProductRepository();
const auditLogRepository = new PrismaAuditLogRepository();
const stockRepository = new PrismaStockRepository();
const companyRepository = new PrismaCompanyRepository();
const invoicePersistenceRepository = new PrismaInvoicePersistenceRepository();

// Injeção - Notas Fiscais e Auditoria
const readInvoiceUseCase = new ReadInvoiceUseCase(
  storageProvider, 
  aiProvider, 
  productRepository, 
  auditLogRepository,
  stockRepository,
  invoicePersistenceRepository
);

const uploadInvoiceController = new UploadInvoiceController(readInvoiceUseCase, storageProvider);
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

// INJEÇÃO - EMPRESA
const createCompanyUseCase = new CreateCompanyUseCase(
  companyRepository,
  stockRepository,
  auditLogRepository
);
const createCompanyController = new CreateCompanyController(createCompanyUseCase);

// ROTAS
routes.post(
  '/invoices/upload',
  ensureAuthenticated,  // 1º: Valida o token do usuário (se falhar, para aqui)
  uploadRateLimiter,    // 2º: Checa limite de requisições por usuário/IP (se exceder, para aqui)
  invoiceUpload.single('file'),// 3º: Só grava o arquivo em disk/tmp se passou na auth e no rate limit
  uploadInvoiceController.handle.bind(uploadInvoiceController) // 4º: Processa a regra
);

routes.post('/users', userRegistrationRateLimiter, validateBody(registerUserBodySchema), registerUserController.handle.bind(registerUserController));

// ROTA DE LOGIN
routes.post('/login', loginRateLimiter, validateBody(loginBodySchema), loginController.handle.bind(loginController));

routes.get('/products', ensureAuthenticated, validateQuery(listProductsQuerySchema), listProductsController.handle.bind(listProductsController));

// ROTA DE CRIAÇÃO DE EMPRESA
routes.post('/companies', ensureAuthenticated, validateBody(createCompanyBodySchema), createCompanyController.handle.bind(createCompanyController));
