import { defineConfig, devices } from '@playwright/test';

// E2E at 1440 px and 390 px (BUILD.md §9.4). Runs against E2E_BASE_URL, or starts `next start` locally.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3300';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npx next start -p 3300', url: 'http://localhost:3300/api/health', reuseExistingServer: true, timeout: 120_000 },
});
