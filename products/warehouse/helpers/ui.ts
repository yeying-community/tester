/**
 * Frontend reachability probe for warehouse UI specs.
 *
 * The warehouse Vite dev server (5173) is not always running in this
 * environment (it collides with knowledge's 5173 and is frequently down).
 * UI cases must skip cleanly — never fail — when the SPA can't be reached,
 * per the test-plan contract. `frontendReachable(baseURL)` does a single
 * cheap GET and caches the result per worker so each spec pays the probe
 * cost at most once.
 */
import { request } from '@playwright/test';

let cached: boolean | undefined;

export async function frontendReachable(baseURL: string | undefined): Promise<boolean> {
  if (!baseURL) return false;
  if (cached !== undefined) return cached;
  try {
    const ctx = await request.newContext();
    try {
      const res = await ctx.get(baseURL, { timeout: 4000 });
      cached = res.status() > 0 && res.status() < 500;
    } finally {
      await ctx.dispose();
    }
  } catch {
    cached = false;
  }
  return cached;
}
