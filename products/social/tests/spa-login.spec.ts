/**
 * social — deeper user-flow: SPA login.
 *
 * Track 2 of the user-perspective baseline. Social is a Vue 2 SPA with
 * hash-based routing (`createWebHashHistory`); `/` redirects to `/login`,
 * and the login view (`web/src/view/Login.vue`) exposes two real auth
 * paths:
 *
 *   - `.wallet-login-button` — wallet sign-in (covered in
 *     products/wallet/tests/ if/when a dapp-social spec is added; out of
 *     scope here)
 *   - QR-code identity mode — toggled via the corner ribbon
 *     `.login-mode-switch-box`, which kicks off
 *     `createIdentityLoginSession()` and renders a QR. A small
 *     `.login-passport-local` link then offers "无法扫码？使用本机通行证登录"
 *     which opens the passport `verifyUrl` in a new tab — there's no
 *     local credential form on this page.
 *
 * Selectors come from social/web/src/view/Login.vue (form structure).
 *
 * Note: uses `SOCIAL_WEB_URL` (the SPA at :8082), NOT `SOCIAL_BASE_URL`
 * (the Spring Boot backend at :8888).
 */
import { test, expect, envFor } from '../fixtures';

const spaURL = () => envFor('social')['SOCIAL_WEB_URL']!;

function skipIfNoSPA() {
  test.skip(!envFor('social')['SOCIAL_WEB_URL'], 'SOCIAL_WEB_URL not configured');
}

test('root redirects to /login via hash routing', async ({ page }) => {
  skipIfNoSPA();
  await page.goto(spaURL());
  await expect(page).toHaveURL(/#\/login$/);
});

test('login form shows the wallet button by default', async ({ page }) => {
  skipIfNoSPA();
  await page.goto(`${spaURL()}/#/login`);
  // Default mode is wallet — that's the primary entry point.
  await expect(page.locator('.wallet-login-button')).toBeVisible({ timeout: 10_000 });
});

test('switching to identity mode renders the QR + passport-local link', async ({ page }) => {
  skipIfNoSPA();
  await page.goto(`${spaURL()}/#/login`);
  // The corner ribbon toggles between wallet and identity modes.
  await page.locator('.login-mode-switch-box').click();
  // After toggling, the QR frame and the "scan-failed" fallback link
  // both appear. We assert both are visible — that's the real UX shape.
  await expect(page.locator('.login-qrcode-frame')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.login-passport-local')).toBeVisible({ timeout: 10_000 });
});

test('identity mode triggers a passport session (QR or loading state)', async ({ page }) => {
  skipIfNoSPA();
  await page.goto(`${spaURL()}/#/login`);
  await page.locator('.login-mode-switch-box').click();
  // After switching, the SPA fires `createIdentityLoginSession()`.
  // The QR frame is shown immediately; either the rendered `<img>` or
  // the "二维码生成中..." loading placeholder is visible within a few
  // seconds (whichever renders first is fine — what matters is that
  // the API round-trip was attempted).
  await expect(page.locator('.login-qrcode-frame')).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator('.login-qrcode-image, .login-qrcode-loading')
  ).toBeVisible({ timeout: 15_000 });
});