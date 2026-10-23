import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.POKER_E2E_PORT ?? 3200);

export default defineConfig({
  testDir: './e2e/poker',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  outputDir: './test-results/poker',
  use: {
    baseURL: process.env.POKER_E2E_BASE ?? `http://127.0.0.1:${port}`,
    timezoneId: 'UTC',
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.POKER_E2E_BASE
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: `http://127.0.0.1:${port}/play?pkv2=1`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
