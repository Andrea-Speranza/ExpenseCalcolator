import { defineConfig, devices } from '@playwright/test';

// Test E2E della web app: la build vera, servita in locale, in un browser vero con IndexedDB.
// In locale su Windows usano Edge, già installato (nessun download). Altrove, e nella CI, usano il Chromium
// di Playwright: si installa una volta con `pnpm --filter @expense/web exec playwright install chromium`.

const PORT = 4174;
const CI = process.env['CI'] !== undefined;
const useEdge = process.platform === 'win32' && !CI;

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}/`,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'telefono',
      use: { ...devices['Pixel 7'], ...(useEdge ? { channel: 'msedge' } : {}) },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    cwd: '..',
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: false,
  },
});
