/**
 * project — YeYing / DooTask task manager.
 *
 * Env vars consumed:
 *   - PROJECT_BASE_URL (default http://localhost:20833)
 *   - APP_DEV_PORT (echoed back to verify env plumbing)
 *   - PROJECT_USER / PROJECT_PASS (optional; gated auth-flow tests)
 */
import { test, expect, baseURLFor, hasEnv } from '../fixtures';

test('login page renders', async ({ page }) => {
  test.skip(!baseURLFor('project'), 'PROJECT_BASE_URL not configured');
  await page.goto('/');
  // Wait for the login view to mount (the "邮箱密码登录" toggle is a concrete
  // element of it) before reading text — bare `load` fires on the empty shell.
  await page
    .getByRole('button', { name: /邮箱密码登录/ })
    .waitFor({ state: 'visible', timeout: 15_000 });
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(0);
});

test('login page exposes a username field', async ({ page }) => {
  test.skip(!baseURLFor('project'), 'PROJECT_BASE_URL not configured');
  await page.goto('/');
  // DooTask now serves the shared IM SPA: `/` redirects to `/#/login`, which
  // defaults to wallet login. The email/password inputs are revealed only
  // after clicking the "邮箱密码登录" toggle.
  const emailPasswordToggle = page.getByRole('button', { name: /邮箱密码登录/ });
  await emailPasswordToggle.waitFor({ state: 'visible', timeout: 15_000 });
  await emailPasswordToggle.click();
  const candidates = page.locator(
    'input[type="text"], input[type="email"], input[name="email" i], input[name="account" i]',
  );
  await expect(candidates.first()).toBeVisible();
});

test('dashboard nav skipped without PROJECT_USER/PASS', () => {
  test.skip(
    !hasEnv('PROJECT_USER') || !hasEnv('PROJECT_PASS'),
    'PROJECT_USER and PROJECT_PASS required for dashboard tests',
  );
  expect(true).toBe(true);
});

test('APP_DEV_PORT env plumbing check', () => {
  // Sanity: when PROJECT_BASE_URL is set the user should also set APP_DEV_PORT
  // so a developer copy/pasting from .env.example doesn't get surprised.
  if (baseURLFor('project')) {
    expect(hasEnv('APP_DEV_PORT')).toBe(true);
  }
});
