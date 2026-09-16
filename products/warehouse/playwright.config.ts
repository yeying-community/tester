import { defineConfig, devices } from '@playwright/test';
import { baseURLFor } from '../../shared/env';

/**
 * Per-product Playwright project overrides.
 *
 * Root `playwright.config.ts` already declares a project named "warehouse" with the
 * right testDir and baseURL. This file is what gets loaded when you run
 * `pnpm test --config=products/warehouse/playwright.config.ts` or when you target
 * just this product through `--project=warehouse`.
 *
 * It only differs from the root by setting an explicit `metadata.product` tag
 * that specs can read.
 */
const HEADED = process.env.PWHEADLESS === '0';

export default defineConfig({
  testDir: __dirname + '/tests',
  testMatch: /.*\.spec\.ts$/,
  outputDir: 'results/warehouse',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.PWWORKERS ? Number(process.env.PWWORKERS) : undefined,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: baseURLFor('warehouse'),
    headless: !HEADED,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  metadata: { product: 'warehouse' },
});
