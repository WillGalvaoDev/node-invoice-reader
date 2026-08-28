import { z } from 'zod';
import { cnpjSchema } from './cnpj.schema.js';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(128);
const idSchema = z.string().uuid();

export const loginBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const registerUserBodySchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  // Opcional no schema deliberadamente (P4-03): ausência e valor incorreto
  // devem cair no mesmo 403 genérico do use case, sem distinção que revele
  // a existência de uma política de convite.
  inviteCode: z.string().min(1).max(200).optional(),
});

export const createCompanyBodySchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  cnpj: cnpjSchema,
});

export const listProductsQuerySchema = z.strictObject({
  stockId: idSchema,
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(200)).default(50),
  cursor: idSchema.optional(),
});

export const listCompaniesQuerySchema = z.strictObject({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(200)).default(50),
  cursor: idSchema.optional(),
});

export const companyStocksParamsSchema = z.strictObject({ companyId: idSchema });

export const listCompanyStocksQuerySchema = z.strictObject({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(200)).default(50),
  cursor: idSchema.optional(),
});

export const uploadInvoiceBodySchema = z.strictObject({
  stockId: idSchema,
});

export const stockSuggestionParamsSchema = z.strictObject({ stockId: idSchema });
export const suggestionDecisionParamsSchema = z.strictObject({ suggestionId: idSchema });
export const emptyCommandBodySchema = z.strictObject({});

export const changePasswordBodySchema = z.strictObject({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});
