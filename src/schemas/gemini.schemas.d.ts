import { z } from 'zod';
export declare const danfeResponseSchema: z.ZodObject<{
    accessKey: z.ZodString;
    invoiceNumber: z.ZodString;
    series: z.ZodString;
    issuedAt: z.ZodPipe<z.ZodString, z.ZodTransform<Date, string>>;
    totalValue: z.ZodNumber;
    supplier: z.ZodObject<{
        cnpj: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        name: z.ZodString;
        stateRegistration: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    products: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        totalPrice: z.ZodNumber;
        unitMeasurement: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const similarityResponseSchema: z.ZodObject<{
    matchFound: z.ZodBoolean;
    matchedProductId: z.ZodString;
    confidence: z.ZodNumber;
    reason: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=gemini.schemas.d.ts.map