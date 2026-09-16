/**
 * Browser session seeding for social SPA e2e.
 *
 * The SPA reads its JWT from `sessionStorage.accessToken` (and refreshes via
 * `sessionStorage.refreshToken`). Seeding these before the app boots lets a
 * test land directly on an authenticated `#/home/...` route, bypassing the
 * wallet / passport login UI. The token must be a *real* JWT — Home.vue calls
 * `GET /user/self` on mount, and a 400 (未登录) hard-redirects back to `/`.
 */
import type { Page } from '@playwright/test';
import type { LoginVO } from './auth';

/** Inject accessToken/refreshToken into sessionStorage before the first load.
 *
 * The seed runs exactly once (guarded by a localStorage sentinel that survives
 * the app's own `sessionStorage.removeItem` on logout). Without the guard,
 * `addInitScript` would re-run on the post-logout full-page reload
 * (`location.href = "/"`) and re-seed the token, masking the logout redirect. */
export async function seedSession(page: Page, login: LoginVO): Promise<void> {
  await page.addInitScript(
    ([access, refresh]) => {
      if (localStorage.getItem('__e2e_seeded__')) return;
      localStorage.setItem('__e2e_seeded__', '1');
      sessionStorage.setItem('accessToken', access);
      sessionStorage.setItem('refreshToken', refresh);
    },
    [login.accessToken, login.refreshToken] as const,
  );
}
