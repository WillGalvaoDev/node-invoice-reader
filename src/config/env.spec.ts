import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv/config', () => ({}));

const VALID_JWT_SECRET = 'test-jwt-secret-32-characters-minimum';
const VALID_INVITE_CODE = 'test-invite-code-12345';

describe('configuração da aplicação', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/docscan');
    vi.stubEnv('JWT_SECRET', VALID_JWT_SECRET);
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
    vi.stubEnv('INVITE_CODE', VALID_INVITE_CODE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falha explicitamente quando uma variável obrigatória está ausente', async () => {
    const { createEnv } = await import('./env.js');

    expect(() =>
      createEnv({
        DATABASE_URL: 'postgresql://localhost/docscan',
        JWT_SECRET: VALID_JWT_SECRET,
      })
    ).toThrow('Variável de ambiente obrigatória ausente: GEMINI_API_KEY');
  });

  it('retorna uma configuração válida e centralizada', async () => {
    const { createEnv } = await import('./env.js');

    expect(
      createEnv({
        DATABASE_URL: 'postgresql://localhost/docscan',
        JWT_SECRET: VALID_JWT_SECRET,
        GEMINI_API_KEY: 'gemini-key',
        INVITE_CODE: VALID_INVITE_CODE,
        PORT: '4000',
      })
    ).toEqual({
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
      PORT: 4000,
      GEMINI_TIMEOUT_MS: 30_000,
      GEMINI_MAX_ATTEMPTS: 2,
      TRUST_PROXY_HOPS: 0,
      CORS_ALLOWED_ORIGINS: [],
      REQUEST_TIMEOUT_MS: 120_000,
      SHUTDOWN_TIMEOUT_MS: 30_000,
      SIMILARITY_CONFIDENCE_THRESHOLD: 0.7,
      DANFE_MAX_ITEMS: 100,
    });
  });

  it('valida os limites operacionais de request e shutdown', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
    };

    expect(createEnv({ ...required, REQUEST_TIMEOUT_MS: '90000', SHUTDOWN_TIMEOUT_MS: '15000' }))
      .toEqual(expect.objectContaining({ REQUEST_TIMEOUT_MS: 90_000, SHUTDOWN_TIMEOUT_MS: 15_000 }));
    expect(() => createEnv({ ...required, REQUEST_TIMEOUT_MS: '29999' })).toThrow('REQUEST_TIMEOUT_MS');
    expect(() => createEnv({ ...required, REQUEST_TIMEOUT_MS: '300001' })).toThrow('REQUEST_TIMEOUT_MS');
    expect(() => createEnv({ ...required, SHUTDOWN_TIMEOUT_MS: '999' })).toThrow('SHUTDOWN_TIMEOUT_MS');
    expect(() => createEnv({ ...required, SHUTDOWN_TIMEOUT_MS: '120001' })).toThrow('SHUTDOWN_TIMEOUT_MS');
  });

  it('usa a porta 3333 por padrão e rejeita portas inválidas', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
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
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
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

  it('não confia em proxy por padrão e valida a quantidade de hops confiáveis', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
    };

    expect(createEnv(required).TRUST_PROXY_HOPS).toBe(0);
    expect(createEnv({ ...required, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
    expect(() => createEnv({ ...required, TRUST_PROXY_HOPS: '-1' })).toThrow('TRUST_PROXY_HOPS');
    expect(() => createEnv({ ...required, TRUST_PROXY_HOPS: '11' })).toThrow('TRUST_PROXY_HOPS');
  });

  it('limita itens por DANFE com default 100 (D1) e valida a faixa 1-1000', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
    };

    expect(createEnv(required).DANFE_MAX_ITEMS).toBe(100);
    expect(createEnv({ ...required, DANFE_MAX_ITEMS: '1' }).DANFE_MAX_ITEMS).toBe(1);
    expect(createEnv({ ...required, DANFE_MAX_ITEMS: '1000' }).DANFE_MAX_ITEMS).toBe(1000);
    expect(() => createEnv({ ...required, DANFE_MAX_ITEMS: '0' })).toThrow('DANFE_MAX_ITEMS');
    expect(() => createEnv({ ...required, DANFE_MAX_ITEMS: '1001' })).toThrow('DANFE_MAX_ITEMS');
    expect(() => createEnv({ ...required, DANFE_MAX_ITEMS: 'abc' })).toThrow('DANFE_MAX_ITEMS');
  });

  it('centraliza o limiar de confiança de similaridade com default 0.7 e valida a faixa 0-1', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
    };

    expect(createEnv(required).SIMILARITY_CONFIDENCE_THRESHOLD).toBe(0.7);
    expect(createEnv({ ...required, SIMILARITY_CONFIDENCE_THRESHOLD: '0.85' }).SIMILARITY_CONFIDENCE_THRESHOLD).toBe(0.85);
    expect(createEnv({ ...required, SIMILARITY_CONFIDENCE_THRESHOLD: '0' }).SIMILARITY_CONFIDENCE_THRESHOLD).toBe(0);
    expect(createEnv({ ...required, SIMILARITY_CONFIDENCE_THRESHOLD: '1' }).SIMILARITY_CONFIDENCE_THRESHOLD).toBe(1);
    expect(() => createEnv({ ...required, SIMILARITY_CONFIDENCE_THRESHOLD: '-0.01' }))
      .toThrow('SIMILARITY_CONFIDENCE_THRESHOLD');
    expect(() => createEnv({ ...required, SIMILARITY_CONFIDENCE_THRESHOLD: '1.01' }))
      .toThrow('SIMILARITY_CONFIDENCE_THRESHOLD');
    expect(() => createEnv({ ...required, SIMILARITY_CONFIDENCE_THRESHOLD: 'abc' }))
      .toThrow('SIMILARITY_CONFIDENCE_THRESHOLD');
  });

  it('normaliza uma allowlist CORS e usa lista vazia como default seguro', async () => {
    const { createEnv } = await import('./env.js');
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
    };

    expect(createEnv(required).CORS_ALLOWED_ORIGINS).toEqual([]);
    expect(createEnv({
      ...required,
      CORS_ALLOWED_ORIGINS: ' https://app.example.com, ,http://localhost:5173 ',
    }).CORS_ALLOWED_ORIGINS).toEqual(['https://app.example.com', 'http://localhost:5173']);
  });

  it.each([
    '*',
    'https://app.example.com,*',
    'not-an-origin',
    'ftp://app.example.com',
    'https://user:password@app.example.com',
    'https://app.example.com/path',
  ])('rejeita origin CORS insegura ou inválida: %s', async (value) => {
    const { createEnv } = await import('./env.js');

    expect(() => createEnv({
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
      CORS_ALLOWED_ORIGINS: value,
    })).toThrow('CORS_ALLOWED_ORIGINS');
  });

  describe('entropia mínima de JWT_SECRET', () => {
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      GEMINI_API_KEY: 'gemini-key',
      INVITE_CODE: VALID_INVITE_CODE,
    };

    it('falha quando JWT_SECRET está ausente', async () => {
      const { createEnv } = await import('./env.js');

      expect(() => createEnv({ ...required })).toThrow(
        'Variável de ambiente obrigatória ausente: JWT_SECRET'
      );
    });

    it('falha quando JWT_SECRET está vazio', async () => {
      const { createEnv } = await import('./env.js');

      expect(() => createEnv({ ...required, JWT_SECRET: '' })).toThrow(
        'Variável de ambiente obrigatória ausente: JWT_SECRET'
      );
    });

    it('falha quando JWT_SECRET tem entre 1 e 31 caracteres', async () => {
      const { createEnv } = await import('./env.js');

      expect(() => createEnv({ ...required, JWT_SECRET: 'a' })).toThrow(
        'Variável de ambiente inválida: JWT_SECRET'
      );
      expect(() => createEnv({ ...required, JWT_SECRET: 'a'.repeat(31) })).toThrow(
        'Variável de ambiente inválida: JWT_SECRET'
      );
    });

    it('aceita JWT_SECRET com exatamente 32 caracteres', async () => {
      const { createEnv } = await import('./env.js');

      expect(createEnv({ ...required, JWT_SECRET: 'a'.repeat(32) }).JWT_SECRET).toBe(
        'a'.repeat(32)
      );
    });

    it('aceita JWT_SECRET com mais de 32 caracteres', async () => {
      const { createEnv } = await import('./env.js');

      expect(createEnv({ ...required, JWT_SECRET: 'a'.repeat(64) }).JWT_SECRET).toBe(
        'a'.repeat(64)
      );
    });

    it('não reproduz o valor de JWT_SECRET recebido na mensagem de erro', async () => {
      const { createEnv } = await import('./env.js');
      const shortSecret = 'super-secret-value-too-short';

      let thrown: unknown;
      try {
        createEnv({ ...required, JWT_SECRET: shortSecret });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).not.toContain(shortSecret);
    });
  });

  describe('entropia mínima de INVITE_CODE (P4-03)', () => {
    const required = {
      DATABASE_URL: 'postgresql://localhost/docscan',
      JWT_SECRET: VALID_JWT_SECRET,
      GEMINI_API_KEY: 'gemini-key',
    };

    it('falha quando INVITE_CODE está ausente', async () => {
      const { createEnv } = await import('./env.js');

      expect(() => createEnv({ ...required })).toThrow(
        'Variável de ambiente obrigatória ausente: INVITE_CODE'
      );
    });

    it('falha quando INVITE_CODE tem menos de 8 caracteres', async () => {
      const { createEnv } = await import('./env.js');

      expect(() => createEnv({ ...required, INVITE_CODE: 'a'.repeat(7) })).toThrow(
        'Variável de ambiente inválida: INVITE_CODE'
      );
    });

    it('aceita INVITE_CODE com 8 caracteres ou mais', async () => {
      const { createEnv } = await import('./env.js');

      expect(createEnv({ ...required, INVITE_CODE: 'a'.repeat(8) }).INVITE_CODE).toBe('a'.repeat(8));
      expect(createEnv({ ...required, INVITE_CODE: 'a'.repeat(20) }).INVITE_CODE).toBe('a'.repeat(20));
    });

    it('não reproduz o valor de INVITE_CODE recebido na mensagem de erro', async () => {
      const { createEnv } = await import('./env.js');
      const shortCode = 'short12';

      let thrown: unknown;
      try {
        createEnv({ ...required, INVITE_CODE: shortCode });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).not.toContain(shortCode);
    });
  });
});
