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