import { defineConfig } from '@playwright/test';

// Usa o Chrome já instalado (runners do GitHub e máquinas de desenvolvimento) para
// evitar o download de navegadores; E2E_BROWSER_CHANNEL='' usa o Chromium do Playwright.
const channel = process.env.E2E_BROWSER_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    ...(channel && { channel }),
    trace: 'off',
  },
});
