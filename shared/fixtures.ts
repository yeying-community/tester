import { test as base, expect, type Page } from '@playwright/test';
import { baseURLFor, envFor, hasEnv } from './env';
import type { ProductName } from './types';

export interface ProductFixtures {
  /** The product this project is testing. Resolved from `process.env.PRODUCT_NAME`
   *  (set by Playwright via the project metadata) or from the calling spec file. */
  product: ProductName;
  /** Shorthand for `page.goto('/')` resolved against the project baseURL. */
  gotoHome: (path?: string) => Promise<void>;
  /** Skip helper that ties reasons back to env vars. */
  skipIfMissing: (envKey: string, reason?: string) => void;
  /** Convenience for `expect(baseURLFor(product)).toBeDefined()`. */
  requireBaseURL: () => string;
}

export const test = base.extend<ProductFixtures>({
  product: async ({}, use, testInfo) => {
    // Prefer project name; tests may override via test.use({ product: ... })
    const fromEnv = (testInfo.project.metadata?.products as ProductName | undefined) ?? undefined;
    const fallback = testInfo.project.name as ProductName;
    await use(fromEnv ?? fallback);
  },
  gotoHome: async ({ page, baseURL }, use) => {
    await use(async (path = '/') => {
      const url = new URL(path, baseURL ?? 'http://localhost').toString();
      await page.goto(url);
    });
  },
  skipIfMissing: async ({}, use) => {
    await use((envKey: string, reason?: string) => {
      if (!hasEnv(envKey)) {
        test.skip(true, reason ?? `Required env var "${envKey}" is not set.`);
      }
    });
  },
  requireBaseURL: async ({ product }, use) => {
    await use(() => {
      const url = baseURLFor(product);
      if (!url) {
        throw new Error(`No base URL configured for product "${product}". Set ${product.toUpperCase()}_BASE_URL.`);
      }
      return url;
    });
  },
});

export { expect };
export type { Page };

/** Re-export the env loader for product fixtures. */
export { envFor, baseURLFor, hasEnv };
