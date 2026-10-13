import { type RequestHandler } from 'express';
interface HttpController {
    handle: RequestHandler;
}
export interface CreateRoutesOptions {
    authenticate: RequestHandler;
    uploadRateLimiter: RequestHandler;
    loginRateLimiter: RequestHandler;
    userRegistrationRateLimiter: RequestHandler;
    changePasswordRateLimiter: RequestHandler;
    createCompanyRateLimiter: RequestHandler;
    invoiceUpload: RequestHandler;
    /** Ambiente de demonstração (DP-02). Ausente = rotas /demo não existem. */
    demo?: {
        commandRateLimiter: RequestHandler;
        controllers: {
            prepare: HttpController;
            current: HttpController;
            document: HttpController;
            restart: HttpController;
        };
    };
    controllers: {
        registerUser: HttpController;
        login: HttpController;
        createCompany: HttpController;
        listCompanies: HttpController;
        listCompanyStocks: HttpController;
        listProducts: HttpController;
        uploadInvoice: HttpController;
        confirmSuggestion: HttpController;
        rejectSuggestion: HttpController;
        listSuggestions: HttpController;
        changePassword: HttpController;
    };
}
export declare function createRoutes(options: CreateRoutesOptions): import("express-serve-static-core").Router;
export declare const routes: import("express-serve-static-core").Router;
export {};
//# sourceMappingURL=routes.d.ts.map