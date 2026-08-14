import { describe, expect, it } from 'vitest';
import { AppError } from './app-error.js';

describe('AppError', () => {
  it('é um Error com statusCode e stack trace preservados', () => {
    const error = new AppError('Falha conhecida', 409);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Falha conhecida');
    expect(error.statusCode).toBe(409);
    expect(error.stack).toContain('AppError: Falha conhecida');
  });
});
