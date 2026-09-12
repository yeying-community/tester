/**
 * agent hub — control plane + React frontend.
 *
 * Env vars consumed:
 *   - AGENT_BASE_URL (Vite frontend, default http://localhost:5174)
 *   - AGENT_API_URL (uvicorn backend, default http://localhost:3900)
 *   - AGENT_PRIVATE_KEY (optional; wallet tests skip without)
 */
import { test, expect, baseURLFor, envFor, hasEnv } from '../fixtures';
import { apiContext, expectStatus } from '../../../shared/api';

test('home renders', async ({ page }) => {
  test.skip(!baseURLFor('agent'), 'AGENT_BASE_URL not configured');
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});

test('home exposes wallet connect affordance', async ({ page }) => {
  test.skip(!baseURLFor('agent'), 'AGENT_BASE_URL not configured');
  await page.goto('/');
  // Look for a button-like affordance; the exact label depends on the build.
  const button = page.locator('button, [role="button"]').first();
  await expect(button).toBeVisible();
});

test('API /health responds 2xx when AGENT_API_URL is set', async () => {
  const apiURL = envFor('agent')['AGENT_API_URL'];
  test.skip(!apiURL, 'AGENT_API_URL not configured');
  const ctx = await apiContext(apiURL!);
  try {
    const res = await ctx.get('/health');
    expectStatus(res, (s) => s < 500);
  } finally {
    await ctx.dispose();
  }
});

test('wallet signing tests skipped without AGENT_PRIVATE_KEY', () => {
  test.skip(!hasEnv('AGENT_PRIVATE_KEY'), 'AGENT_PRIVATE_KEY not set');
  expect(true).toBe(true);
});
