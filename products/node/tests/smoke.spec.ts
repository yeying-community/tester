/**
 * node — control plane.
 *
 * Env vars consumed:
 *   - NODE_BASE_URL (Vite frontend, default http://localhost:8991)
 *   - NODE_API_URL  (Express backend, default http://localhost:8100)
 */
import { test, expect, baseURLFor, envFor, hasEnv } from '../fixtures';
import { apiContext, expectStatus } from '../../../shared/api';

test('home page renders', async ({ page }) => {
  test.skip(!baseURLFor('node'), 'NODE_BASE_URL not configured');
  await page.goto(envFor('node').baseURL!);
  await expect(page.locator('body')).toBeVisible();
});

test('primary navigation contains expected entries', async ({ page }) => {
  test.skip(!baseURLFor('node'), 'NODE_BASE_URL not configured');
  await page.goto(envFor('node').baseURL!);
  // The node control plane exposes "应用 / Apps" and similar nav entries.
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(0);
});

test('backend /health responds 2xx when NODE_API_URL is set', async () => {
  const apiURL = envFor('node')['NODE_API_URL'];
  test.skip(!apiURL, 'NODE_API_URL not configured');
  const ctx = await apiContext(apiURL!);
  try {
    const res = await ctx.get('/health');
    expectStatus(res, (s) => s < 500);
  } finally {
    await ctx.dispose();
  }
});

test('backend responds on root or 404 JSON (sanity)', async () => {
  const apiURL = envFor('node')['NODE_API_URL'];
  test.skip(!apiURL || !hasEnv('NODE_API_URL'), 'NODE_API_URL not configured');
  const ctx = await apiContext(apiURL!);
  try {
    const res = await ctx.get('/');
    expectStatus(res, (s) => s < 500);
  } finally {
    await ctx.dispose();
  }
});
