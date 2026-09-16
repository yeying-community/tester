import { test as base, expect, type Page } from '@playwright/test';
import { baseURLFor, envFor, hasEnv } from './env';
import type { ProductName } from './types';
import { Recorder } from './record';

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
  /**
   * Opt-in recorder for user-manual generation. Specs that don't call
   * `recorder.step(...)` produce no artifacts. Render with
   * `pnpm manual:build`.
   */
  recorder: Recorder;
}

export const test = base.extend<ProductFixtures>({
  product: async ({}, use, testInfo) => {
    // The project's own name is the canonical product identifier.
    // `metadata.products` (when set by root config) is the env snapshot
    // — keyed by product name — not a single product; tests can read
    // it via `loadEnv()` directly. Tests may override via
    // `test.use({ product: ... })`.
    const fallback = testInfo.project.name as ProductName;
    await use(fallback);
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
  recorder: async ({ product }, use, testInfo) => {
    const r = new Recorder(product, testInfo.title);
    await use(r);
    // Flush steps.json on test completion (pass or fail). No-op when
    // no `step()` calls were made.
    await r.finalize(testInfo.file ?? '', testInfo.status === 'passed');
  },
});

export { expect };
export type { Page };

/** Re-export the env loader for product fixtures. */
export { envFor, baseURLFor, hasEnv };
