import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const idSchema = z.string().uuid();

export const loginBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const registerUserBodySchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const createCompanyBodySchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  cnpj: z.string().trim().min(1).max(32),
});

export const listProductsQuerySchema = z.strictObject({
  stockId: idSchema.optional(),
  companyId: idSchema.optional(),
}).refine(({ stockId, companyId }) => !(stockId && companyId));

export const uploadInvoiceBodySchema = z.strictObject({
  stockId: idSchema,
});
