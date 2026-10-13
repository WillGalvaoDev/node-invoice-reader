import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

/** Emite `version.json` com o SHA do build (somente SHA; sem configuração) para `GET /version`. */
function releaseVersion(): Plugin {
  const sha = process.env.RENDER_GIT_COMMIT ?? process.env.GITHUB_SHA ?? process.env.RELEASE_SHA ?? 'dev';
  return {
    name: 'docscan-release-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ sha }) });
    },
  };
}

// A interface é servida pelo backend em /app (mesma origem da API).
export default defineConfig({
  base: '/app/',
  plugins: [react(), releaseVersion()],
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
