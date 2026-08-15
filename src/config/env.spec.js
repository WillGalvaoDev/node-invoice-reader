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
        expect(() => createEnv({
            DATABASE_URL: 'postgresql://localhost/docscan',
            JWT_SECRET: 'jwt-secret',
        })).toThrow('Variável de ambiente obrigatória ausente: GEMINI_API_KEY');
    });
    it('retorna uma configuração válida e centralizada', async () => {
        const { createEnv } = await import('./env.js');
        expect(createEnv({
            DATABASE_URL: 'postgresql://localhost/docscan',
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
            PORT: '4000',
        })).toEqual({
            DATABASE_URL: 'postgresql://localhost/docscan',
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
            PORT: 4000,
            GEMINI_TIMEOUT_MS: 30_000,
            GEMINI_MAX_ATTEMPTS: 2,
            TRUST_PROXY_HOPS: 0,
            CORS_ALLOWED_ORIGINS: [],
            REQUEST_TIMEOUT_MS: 120_000,
            SHUTDOWN_TIMEOUT_MS: 30_000,
            SIMILARITY_CONFIDENCE_THRESHOLD: 0.7,
        });
    });
    it('valida os limites operacionais de request e shutdown', async () => {
        const { createEnv } = await import('./env.js');
        const required = {
            DATABASE_URL: 'postgresql://localhost/docscan',
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
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
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
        };
        expect(createEnv(required).PORT).toBe(3333);
        expect(() => createEnv({ ...required, PORT: 'abc' })).toThrow('Variável de ambiente inválida: PORT');
        expect(() => createEnv({ ...required, PORT: '70000' })).toThrow('Variável de ambiente inválida: PORT');
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
    it('não confia em proxy por padrão e valida a quantidade de hops confiáveis', async () => {
        const { createEnv } = await import('./env.js');
        const required = {
            DATABASE_URL: 'postgresql://localhost/docscan',
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
        };
        expect(createEnv(required).TRUST_PROXY_HOPS).toBe(0);
        expect(createEnv({ ...required, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
        expect(() => createEnv({ ...required, TRUST_PROXY_HOPS: '-1' })).toThrow('TRUST_PROXY_HOPS');
        expect(() => createEnv({ ...required, TRUST_PROXY_HOPS: '11' })).toThrow('TRUST_PROXY_HOPS');
    });
    it('centraliza o limiar de confiança de similaridade com default 0.7 e valida a faixa 0-1', async () => {
        const { createEnv } = await import('./env.js');
        const required = {
            DATABASE_URL: 'postgresql://localhost/docscan',
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
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
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
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
            JWT_SECRET: 'jwt-secret',
            GEMINI_API_KEY: 'gemini-key',
            CORS_ALLOWED_ORIGINS: value,
        })).toThrow('CORS_ALLOWED_ORIGINS');
    });
});
//# sourceMappingURL=env.spec.js.map