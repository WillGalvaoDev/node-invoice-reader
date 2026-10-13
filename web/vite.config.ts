import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// A interface é servida pelo backend em /app (mesma origem da API).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    // Desenvolvimento: proxy para o backend local; nenhum segredo no bundle.
    proxy: Object.fromEntries(
      ['/users', '/login', '/companies', '/products', '/invoices', '/stocks', '/suggestions', '/me', '/demo', '/health']
        .map((path) => [path, 'http://127.0.0.1:3333']),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
