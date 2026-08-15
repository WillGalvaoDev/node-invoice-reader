import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'src/**/*.js',
      'src/**/*.js.map',
      'src/**/*.d.ts',
      'src/**/*.d.ts.map',
      'test/**/*.d.ts',
      'test/**/*.d.ts.map',
      'prisma.config.js',
      'prisma.config.js.map',
      'prisma.config.d.ts',
      'prisma.config.d.ts.map',
      'vitest.config.js',
      'vitest.config.js.map',
      'vitest.config.d.ts',
      'vitest.config.d.ts.map',
      'vitest.integration.config.js',
      'vitest.integration.config.js.map',
      'vitest.integration.config.d.ts',
      'vitest.integration.config.d.ts.map',
      'prisma/migrations/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts', '*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Classe de bug real que já derrubou o processo em produção (raiz de M1-01).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Dublês leves de Request/Response/mocks são o padrão idiomático deste projeto nos specs.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
);
