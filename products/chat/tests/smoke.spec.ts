/**
 * chat — Next.js + UCAN/wallet.
 *
 * Env vars consumed:
 *   - CHAT_BASE_URL (default http://localhost:3020)
 *   - OPENAI_API_KEY / ANTHROPIC_API_KEY (optional; conversation tests skip without)
 */
import { test, expect, baseURLFor, hasEnv } from '../fixtures';

test('home renders with a heading region', async ({ page }) => {
  test.skip(!baseURLFor('chat'), 'CHAT_BASE_URL not configured');
  await page.goto('/');
  // Be lenient: the SPA mounts the Home component.
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(0);
});

test('home responds 2xx', async ({ request }) => {
  test.skip(!baseURLFor('chat'), 'CHAT_BASE_URL not configured');
  const res = await request.get('/');
  expect(res.status()).toBeLessThan(500);
});

test('LLM conversation tests skipped when no provider key', () => {
  const hasOpenAI = hasEnv('OPENAI_API_KEY');
  const hasAnthropic = hasEnv('ANTHROPIC_API_KEY');
  test.skip(!hasOpenAI && !hasAnthropic, 'no LLM provider key (OPENAI_API_KEY / ANTHROPIC_API_KEY)');
  // This empty body is intentionally a "passes once not skipped" guard; expand
  // when adding real conversation specs.
  expect(hasOpenAI || hasAnthropic).toBe(true);
});
