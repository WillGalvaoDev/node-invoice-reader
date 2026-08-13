import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv/config', () => ({}));

describe('configuração da aplicação', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/docscan');
    vi.stubEnv('JWT_SECRET', 'jwt-secret');
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falha explicitamente quando uma variável obrigatória está ausente', async () => {
    const { createEnv } = await import('./env.js');

    expect(() =>
      createEnv({
        DATABASE_URL: 'postgresql://localhost/docscan',
        JWT_SECRET: 'jwt-secret',
      })
    ).toThrow('Variável de ambiente obrigatória ausente: GEMINI_API_KEY');
  });

  it('retorna uma configuração válida e centralizada', async () => {
    const { createEnv } = await import('./env.js');

    expect(
      createEnv({
        DATABASE_URL: 'postgresql://localhost/docscan',
        JWT_SECRET: 'jwt-secret',
        GEMINI_API_KEY: 'gemini-key',
        PORT: '4000',
      })
    ).toEqual({
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: 'jwt-secret',
      GEMINI_API_KEY: 'gemini-key',
      PORT: 4000,
      GEMINI_TIMEOUT_MS: 30_000,
      GEMINI_MAX_ATTEMPTS: 2,
    });
  });

  it('usa a porta 3333 por padrão e rejeita portas inválidas', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: 'jwt-secret',
      GEMINI_API_KEY: 'gemini-key',
    };

    expect(createEnv(required).PORT).toBe(3333);
    expect(() => createEnv({ ...required, PORT: 'abc' })).toThrow(
      'Variável de ambiente inválida: PORT'
    );
    expect(() => createEnv({ ...required, PORT: '70000' })).toThrow(
      'Variável de ambiente inválida: PORT'
    );
  });

  it('aplica defaults seguros e rejeita configuracao Gemini fora da faixa', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: 'jwt-secret',
      GEMINI_API_KEY: 'gemini-key',
    };

    expect(createEnv(required)).toEqual(expect.objectContaining({
      GEMINI_TIMEOUT_MS: 30_000,
      GEMINI_MAX_ATTEMPTS: 2,
    }));
    expect(() => createEnv({ ...required, GEMINI_TIMEOUT_MS: '999' })).toThrow('GEMINI_TIMEOUT_MS');
    expect(() => createEnv({ ...required, GEMINI_TIMEOUT_MS: '30001' })).toThrow('GEMINI_TIMEOUT_MS');
    expect(() => createEnv({ ...required, GEMINI_MAX_ATTEMPTS: '0' })).toThrow('GEMINI_MAX_ATTEMPTS');
    expect(() => createEnv({ ...required, GEMINI_MAX_ATTEMPTS: '3' })).toThrow('GEMINI_MAX_ATTEMPTS');
  });
});
