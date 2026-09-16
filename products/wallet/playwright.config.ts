import { defineConfig, devices } from '@playwright/test';

/**
 * Per-product Playwright overrides for the `wallet` product.
 *
 * The wallet is a Chromium MV3 extension loaded via `--load-extension`.
 * Root `playwright.config.ts` already declares a project named "wallet"
 * with the right launch flags; this file is what gets loaded when you run
 * `pnpm test --config=products/wallet/playwright.config.ts` or when you
 * target just this product through `--project=wallet`.
 *
 * It only differs from the root by setting an explicit `metadata.product`
 * tag that specs can read.
 */
const HEADED = process.env.PWHEADLESS === '0';
const walletExtensionPath =
  process.env['WALLET_EXTENSION_PATH']?.trim() || process.env['WALLET_REPO_PATH']?.trim() || '';

export default defineConfig({
  testDir: __dirname + '/tests',
  testMatch: /.*\.spec\.ts$/,
  outputDir: 'results/wallet',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // Wallet popup tests share a persistent userDataDir per test and rely on
  // serial extension-service-worker registration; do not parallelise within
  // a worker either.
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    headless: !HEADED,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    launchOptions: walletExtensionPath
      ? {
          channel: 'chromium',
          headless: false,
          args: [
            `--disable-extensions-except=${walletExtensionPath}`,
            `--load-extension=${walletExtensionPath}`,
          ],
        }
      : { channel: 'chromium', headless: false },
  },
  metadata: { product: 'wallet' },
});