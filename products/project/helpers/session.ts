/**
 * project (YeYing / DooTask) UI session helper.
 *
 * The router redirects unauthenticated visits to `/manage/*` back to the login
 * page, and the URL-param token bootstrap races the guard, so the reliable way
 * to get a logged-in UI session is to drive the real login form:
 *
 *   1. register a throwaway account over the API (registration is open, no
 *      captcha on a fresh account) — see helpers/api.ts
 *   2. open the login page (language forced to zh so assertions can match the
 *      Chinese UI strings)
 *   3. expand the e-mail panel, type credentials, submit
 *   4. the app forwards to `/manage/dashboard` on success
 *
 * Env vars consumed (indirectly, via callers):
 *   - PROJECT_BASE_URL
 */
import { expect, type Page } from '@playwright/test';
import { registerUser, type RegisteredUser } from './api';

export interface SeededUiSession extends RegisteredUser {}

/** Force the SPA language to Chinese before it boots. */
async function forceChinese(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      (globalThis as any).localStorage.setItem('__system:languageName__', 'zh');
    } catch {
      /* ignore */
    }
  });
}

/** Log in through the real login form using an already-registered account. */
export async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await forceChinese(page);
  await page.goto('/?language=zh', { waitUntil: 'domcontentloaded' });

  // The e-mail panel is collapsed by default on the login view; expand it.
  const toggle = page.locator('.email-login-toggle');
  await toggle.first().waitFor({ state: 'visible', timeout: 15_000 });
  await toggle.first().click();

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  // Submit: the login button lives at the bottom of the e-mail panel.
  await passwordInput.press('Enter');

  // On success the app forwards to the dashboard route.
  await page.waitForURL(/\/manage\/dashboard/, { timeout: 20_000 });
}

/**
 * Register a fresh account and log it in through the UI. Returns the account so
 * specs can drive further actions.
 */
export async function seedUiSession(page: Page, baseURL: string): Promise<SeededUiSession> {
  const account = await registerUser(baseURL);
  await uiLogin(page, account.email, account.password);
  expect(page.url()).toContain('/manage/dashboard');
  return account;
}
