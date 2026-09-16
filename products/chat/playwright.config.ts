import { defineConfig, devices } from '@playwright/test';
import { baseURLFor } from '../../shared/env';

/**
 * Per-product Playwright project overrides.
 *
 * Root `playwright.config.ts` already declares a project named "chat" with the
 * right testDir and baseURL. This file is what gets loaded when you run
 * `pnpm test --config=products/chat/playwright.config.ts` or when you target
 * just this product through `--project=chat`.
 *
 * It only differs from the root by setting an explicit `metadata.product` tag
 * that specs can read.
 */
const HEADED = process.env.PWHEADLESS === '0';

export default defineConfig({
  testDir: __dirname + '/tests',
  testMatch: /.*\.spec\.ts$/,
  outputDir: 'results/chat',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PWWORKERS ? Number(process.env.PWWORKERS) : undefined,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: baseURLFor('chat'),
    headless: !HEADED,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 60000,
  },
  metadata: { product: 'chat' },
});
