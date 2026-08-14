import { z } from 'zod';
import { cnpjSchema } from './cnpj.schema.js';
const finiteNonNegativeNumber = z.number().finite().nonnegative();
const finitePositiveNumber = z.number().finite().positive();
const issuedAtSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value, context) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        context.addIssue({ code: 'custom', message: 'Invalid calendar date' });
        return z.NEVER;
    }
    return date;
});
export const danfeResponseSchema = z.object({
    accessKey: z.string().regex(/^\d{44}$/),
    invoiceNumber: z.string().min(1),
    series: z.string().min(1),
    issuedAt: issuedAtSchema,
    totalValue: finiteNonNegativeNumber,
    supplier: z.object({
        cnpj: cnpjSchema,
        name: z.string().min(1),
        stateRegistration: z.string().min(1).optional(),
    }),
    products: z.array(z.object({
        code: z.string().min(1),
        description: z.string().min(1),
        quantity: finitePositiveNumber,
        unitPrice: finiteNonNegativeNumber,
        totalPrice: finiteNonNegativeNumber,
        unitMeasurement: z.string().min(1),
    })).min(1),
});
export const similarityResponseSchema = z.object({
    matchFound: z.boolean(),
    matchedProductId: z.string(),
    confidence: z.number().finite().min(0).max(1),
    reason: z.string(),
});
//# sourceMappingURL=gemini.schemas.js.map