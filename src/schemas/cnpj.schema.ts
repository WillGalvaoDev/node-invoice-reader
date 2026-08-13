import { z } from 'zod';
import { parseCnpj } from '../domain/cnpj.js';

export const cnpjSchema = z.string().transform((value, context) => {
  try {
    return parseCnpj(value);
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid CNPJ' });
    return z.NEVER;
  }
});
