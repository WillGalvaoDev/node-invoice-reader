import { Router } from 'express';
import { createEnsureAuthenticated } from './middlewares/ensure-authenticated.js';
import { uploadRateLimiter } from './middlewares/upload-rate-limiter.js';
import { RegisterUserController } from './controllers/register-user.controller.js';
import { UploadInvoiceController } from './controllers/upload-invoice.controller.js';
import { ReadInvoiceUseCase } from './use-cases/read-invoice/read-invoice.use-case.js';
import { PrismaProductRepository } from './repositories/prisma-product.repository.js';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository.js';
import { DiskStorageProvider } from './providers/implementations/disk-storage.provider.js';
import { GeminiAiProvider, GEMINI_MODEL } from './providers/gemini-ai.provider.js';
import { PrismaAiTelemetry } from './infra/prisma-ai-telemetry.js';
import { AiBudgetGuard } from './providers/ai-budget-guard.js';
import { PrismaAiUsageLedgerRepository } from './repositories/prisma-ai-usage-ledger.repository.js';
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
import { ListCompaniesUseCase } from './use-cases/list-companies/list-companies.use-case.js';
import { ListCompaniesController } from './controllers/list-companies.controller.js';
import { ListCompanyStocksUseCase } from './use-cases/list-company-stocks/list-company-stocks.use-case.js';
import { ListCompanyStocksController } from './controllers/list-company-stocks.controller.js';
// EMPRESAS
import { CreateCompanyUseCase } from './use-cases/create-company/create-company.use-case.js';
import { CreateCompanyController } from './controllers/create-company.controller.js';
import { PrismaCompanyRepository } from './repositories/prisma-company.repository.js';
import { PrismaStockRepository } from './repositories/prisma-stock.repository.js';
import { PrismaInvoicePersistenceRepository } from './repositories/prisma-invoice-persistence.repository.js';
import { invoiceUpload } from './middlewares/invoice-upload.js';
import { loginRateLimiter, userRegistrationRateLimiter } from './middlewares/auth-rate-limiters.js';
import { validateBody, validateParams, validateQuery } from './middlewares/validate-request.js';
import { companyStocksParamsSchema, createCompanyBodySchema, listCompaniesQuerySchema, listCompanyStocksQuerySchema, listProductsQuerySchema, loginBodySchema, registerUserBodySchema, stockSuggestionParamsSchema, suggestionDecisionParamsSchema, emptyCommandBodySchema, changePasswordBodySchema, } from './schemas/http.schemas.js';
import { PrismaProductSuggestionRepository } from './repositories/prisma-product-suggestion.repository.js';
import { ConfirmProductSuggestionUseCase } from './use-cases/product-suggestions/confirm-product-suggestion.use-case.js';
import { RejectProductSuggestionUseCase } from './use-cases/product-suggestions/reject-product-suggestion.use-case.js';
import { ListPendingProductSuggestionsUseCase } from './use-cases/product-suggestions/list-pending-product-suggestions.use-case.js';
import { ConfirmProductSuggestionController, RejectProductSuggestionController, ListPendingProductSuggestionsController, } from './controllers/product-suggestion.controllers.js';
import { ChangePasswordUseCase } from './use-cases/change-password/change-password.use-case.js';
import { ChangePasswordController } from './controllers/change-password.controller.js';
import { changePasswordRateLimiter } from './middlewares/change-password-rate-limiter.js';
import { createCompanyRateLimiter } from './middlewares/create-company-rate-limiter.js';
import { env } from './config/env.js';
export function createRoutes(options) {
    const router = Router();
    const { controllers } = options;
    router.post('/invoices/upload', options.authenticate, options.uploadRateLimiter, options.invoiceUpload, controllers.uploadInvoice.handle.bind(controllers.uploadInvoice));
    router.post('/users', options.userRegistrationRateLimiter, validateBody(registerUserBodySchema), controllers.registerUser.handle.bind(controllers.registerUser));
    router.post('/login', options.loginRateLimiter, validateBody(loginBodySchema), controllers.login.handle.bind(controllers.login));
    router.get('/products', options.authenticate, validateQuery(listProductsQuerySchema), controllers.listProducts.handle.bind(controllers.listProducts));
    router.post('/companies', options.authenticate, options.createCompanyRateLimiter, validateBody(createCompanyBodySchema), controllers.createCompany.handle.bind(controllers.createCompany));
    router.get('/companies', options.authenticate, validateQuery(listCompaniesQuerySchema), controllers.listCompanies.handle.bind(controllers.listCompanies));
    router.get('/companies/:companyId/stocks', options.authenticate, validateParams(companyStocksParamsSchema), validateQuery(listCompanyStocksQuerySchema), controllers.listCompanyStocks.handle.bind(controllers.listCompanyStocks));
    router.get('/stocks/:stockId/suggestions', options.authenticate, validateParams(stockSuggestionParamsSchema), controllers.listSuggestions.handle.bind(controllers.listSuggestions));
    router.post('/suggestions/:suggestionId/confirm', options.authenticate, validateParams(suggestionDecisionParamsSchema), validateBody(emptyCommandBodySchema), controllers.confirmSuggestion.handle.bind(controllers.confirmSuggestion));
    router.post('/suggestions/:suggestionId/reject', options.authenticate, validateParams(suggestionDecisionParamsSchema), validateBody(emptyCommandBodySchema), controllers.rejectSuggestion.handle.bind(controllers.rejectSuggestion));
    router.patch('/me/password', options.authenticate, options.changePasswordRateLimiter, validateBody(changePasswordBodySchema), controllers.changePassword.handle.bind(controllers.changePassword));
    return router;
}
// Injeção - Compartilhados / Repositórios
const storageProvider = new DiskStorageProvider();
const aiUsageLedgerRepository = new PrismaAiUsageLedgerRepository();
const aiBudgetGuard = new AiBudgetGuard(aiUsageLedgerRepository, GEMINI_MODEL);
const aiProvider = new GeminiAiProvider({ telemetry: new PrismaAiTelemetry(), budgetGuard: aiBudgetGuard });
const productRepository = new PrismaProductRepository();
const auditLogRepository = new PrismaAuditLogRepository();
const stockRepository = new PrismaStockRepository();
const companyRepository = new PrismaCompanyRepository();
const invoicePersistenceRepository = new PrismaInvoicePersistenceRepository();
const productSuggestionRepository = new PrismaProductSuggestionRepository();
// Injeção - Notas Fiscais e Auditoria
const readInvoiceUseCase = new ReadInvoiceUseCase(storageProvider, aiProvider, productRepository, auditLogRepository, stockRepository, invoicePersistenceRepository);
const uploadInvoiceController = new UploadInvoiceController(readInvoiceUseCase, storageProvider);
const listProductsUseCase = new ListProductsUseCase(productRepository, stockRepository);
const listProductsController = new ListProductsController(listProductsUseCase);
// Compartilhado - Usuários
const userRepository = new PrismaUserRepository();
const hashProvider = new Argon2HashProvider();
// Injeção - Cadastro
const registerUserUseCase = new RegisterUserUseCase(userRepository, hashProvider, env.INVITE_CODE);
const registerUserController = new RegisterUserController(registerUserUseCase);
// INJEÇÃO - LOGIN
const tokenProvider = new JoseTokenProvider();
const ensureAuthenticated = createEnsureAuthenticated({ tokenProvider, userRepository });
const loginUseCase = new LoginUseCase(userRepository, hashProvider, tokenProvider);
const loginController = new LoginController(loginUseCase);
// INJEÇÃO - TROCA DE SENHA
const changePasswordUseCase = new ChangePasswordUseCase(userRepository, hashProvider, auditLogRepository);
const changePasswordController = new ChangePasswordController(changePasswordUseCase);
// INJEÇÃO - EMPRESA
const createCompanyUseCase = new CreateCompanyUseCase(companyRepository, auditLogRepository);
const createCompanyController = new CreateCompanyController(createCompanyUseCase);
const listCompaniesController = new ListCompaniesController(new ListCompaniesUseCase(companyRepository));
const listCompanyStocksController = new ListCompanyStocksController(new ListCompanyStocksUseCase(companyRepository, stockRepository));
const confirmSuggestionController = new ConfirmProductSuggestionController(new ConfirmProductSuggestionUseCase(productSuggestionRepository, stockRepository, auditLogRepository));
const rejectSuggestionController = new RejectProductSuggestionController(new RejectProductSuggestionUseCase(productSuggestionRepository, stockRepository, auditLogRepository));
const listSuggestionsController = new ListPendingProductSuggestionsController(new ListPendingProductSuggestionsUseCase(productSuggestionRepository, stockRepository));
export const routes = createRoutes({
    authenticate: ensureAuthenticated,
    uploadRateLimiter,
    loginRateLimiter,
    userRegistrationRateLimiter,
    changePasswordRateLimiter,
    createCompanyRateLimiter,
    invoiceUpload: invoiceUpload.single('file'),
    controllers: {
        registerUser: registerUserController,
        login: loginController,
        createCompany: createCompanyController,
        listCompanies: listCompaniesController,
        listCompanyStocks: listCompanyStocksController,
        listProducts: listProductsController,
        uploadInvoice: uploadInvoiceController,
        confirmSuggestion: confirmSuggestionController,
        rejectSuggestion: rejectSuggestionController,
        changePassword: changePasswordController,
        listSuggestions: listSuggestionsController,
    },
});
//# sourceMappingURL=routes.js.map