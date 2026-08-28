import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl } from './database-url.js';

// P5-01: prisma.config.ts precisa de DATABASE_URL apenas — não de JWT_SECRET
// nem GEMINI_API_KEY. Isso evita que rodar uma migration exija a chave do
// Gemini, inclusive quando o operador rodar da própria máquina.
describe('resolveDatabaseUrl', () => {
  it('retorna o valor de DATABASE_URL, sem exigir nenhuma outra variável', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgresql://localhost/docscan' })).toBe(
      'postgresql://localhost/docscan',
    );
  });

  it('falha explicitamente quando DATABASE_URL está ausente', () => {
    expect(() => resolveDatabaseUrl({})).toThrow(
      'Variável de ambiente obrigatória ausente: DATABASE_URL',
    );
  });

  it('falha explicitamente quando DATABASE_URL está vazia', () => {
    expect(() => resolveDatabaseUrl({ DATABASE_URL: '   ' })).toThrow(
      'Variável de ambiente obrigatória ausente: DATABASE_URL',
    );
  });

  it('remove espaços em volta do valor', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: '  postgresql://localhost/docscan  ' })).toBe(
      'postgresql://localhost/docscan',
    );
  });
});
