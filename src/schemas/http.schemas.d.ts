import { z } from 'zod';
export declare const loginBodySchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strict>;
export declare const registerUserBodySchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strict>;
export declare const createCompanyBodySchema: z.ZodObject<{
    name: z.ZodString;
    cnpj: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>;
export declare const listProductsQuerySchema: z.ZodObject<{
    stockId: z.ZodString;
    limit: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const listCompaniesQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const uploadInvoiceBodySchema: z.ZodObject<{
    stockId: z.ZodString;
}, z.core.$strict>;
export declare const stockSuggestionParamsSchema: z.ZodObject<{
    stockId: z.ZodString;
}, z.core.$strict>;
export declare const suggestionDecisionParamsSchema: z.ZodObject<{
    suggestionId: z.ZodString;
}, z.core.$strict>;
export declare const emptyCommandBodySchema: z.ZodObject<{}, z.core.$strict>;
//# sourceMappingURL=http.schemas.d.ts.map