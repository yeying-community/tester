import { defineConfig, devices, type Project } from '@playwright/test';
import { baseURLFor, loadEnv } from './shared/env';
import { defaultReporters } from './shared/reporters';

const HEADED = process.env.PWHEADLESS === '0';

const products = [
  'warehouse',
  'node',
  'router',
  'chat',
  'social',
  'project',
  'knowledge',
  'marketplace',
  'books',
  'agent',
] as const;

type ProductName = (typeof products)[number];

const chatOverrides = { navigationTimeout: 60_000, actionTimeout: 15_000 };

const projects: Project[] = products.map((product: ProductName) => ({
  name: product,
  testDir: `products/${product}/tests`,
  testMatch: /.*\.spec\.ts$/,
  outputDir: `test-results/${product}`,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: baseURLFor(product),
    headless: !HEADED,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    ...(product === 'chat' ? chatOverrides : {}),
  },
}));

export default defineConfig({
  testDir: '.',
  // testDir is overridden per-project; this keeps the root happy when run with --list.
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PWWORKERS ? Number(process.env.PWWORKERS) : undefined,
  reporter: defaultReporters(),
  // Snapshot env once so each spec sees a consistent view.
  globalSetup: undefined,
  use: {
    headless: !HEADED,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects,
  metadata: {
    products: loadEnv(),
  },
});
