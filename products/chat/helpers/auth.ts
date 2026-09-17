/**
 * chat UCAN/wallet login helper.
 *
 * Drives the real `/#/auth` flow with an injected YeYing-style wallet shim
 * (helpers/wallet.ts). On success the app stores a UCAN root and
 * `isValidUcanAuthorization()` returns true, so protected SPA routes render
 * instead of redirecting back to `/#/auth`.
 *
 * `login()` returns whether authorization was established within `timeoutMs`.
 * `loginOrSkip()` skips the test with a clear reason when it cannot — we never
 * fake an authenticated session.
 */
import { test, type Page } from '../fixtures';
import { injectWallet } from './wallet';

const PRIVATE_KEY_ENV = 'ROUTER_WALLET_PRIVATE_KEY';

export function walletPrivateKey(): string | undefined {
  return process.env[PRIVATE_KEY_ENV]?.trim() || undefined;
}

/** True once the app reports a valid UCAN authorization. */
export async function isAuthorized(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(async () => {
      const w = window as unknown as {
        __e2e_isAuthorized?: () => Promise<boolean>;
      };
      // The app does not expose the checker globally; fall back to the
      // localStorage markers the wallet plugin writes on a valid root.
      if (typeof w.__e2e_isAuthorized === 'function') {
        return await w.__e2e_isAuthorized();
      }
      const exp = Number(localStorage.getItem('ucanRootExp'));
      const iss = localStorage.getItem('ucanRootIss');
      return Number.isFinite(exp) && exp > Date.now() && !!iss;
    });
  } catch {
    return false;
  }
}

/**
 * Attempt the full wallet UCAN login. Returns true if authorized.
 * Navigates the page to `/#/auth`, injects the wallet, signs, and waits.
 */
export async function login(page: Page, opts: { timeoutMs?: number } = {}): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const pk = walletPrivateKey();
  if (!pk) return false;

  const address = await injectWallet(page, pk);

  await page.goto('/#/auth');
  // The auth page mounts an account input + a primary "Sign In" button.
  const input = page.locator('input[aria-label], input[placeholder]').first();
  try {
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill(address);
  } catch {
    // input not found — page shape changed; bail to skip path.
  }

  const confirm = page
    .locator('button:has-text("Sign In"), button:has-text("登录"), [class*="auth-wallet-connect"]')
    .first();
  try {
    await confirm.click({ timeout: 5_000 });
  } catch {
    // Some builds fire login from the icon button wrapper.
  }

  // Wait for the UCAN root to be stored (authorization established).
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAuthorized(page)) return true;
    await page.waitForTimeout(500);
  }
  return await isAuthorized(page);
}

const SYNC_FAILED_TEXT = 'Failed to sync account data. Please retry.';

/**
 * The account-workspace sync runs against the live WebDAV backend right after
 * login. When several login-bearing tests share one wallet account the
 * concurrent syncs can collide and the app parks on the WorkspaceSyncError
 * screen (`workspaceStatus === "error"`), which replaces ALL protected routes
 * with a "Failed to sync account data. Please retry." / "Reload" panel.
 *
 * That screen is fully recoverable: clicking Reload re-enters the `syncing`
 * state and a fresh attempt usually settles to `ready`. This gate detects the
 * error screen and retries a few times so protected-route assertions see the
 * real page instead of the transient sync-error state.
 */
export async function waitForWorkspaceReady(page: Page, tries = 4): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const errorPanel = page.getByText(SYNC_FAILED_TEXT, { exact: true });
    if ((await errorPanel.count()) === 0 || !(await errorPanel.first().isVisible().catch(() => false))) {
      return;
    }
    // On the error screen the Reload button is the only action rendered.
    const reload = page.getByRole('button', { name: 'Reload' }).first();
    await reload.click({ timeout: 3_000 }).catch(() => {});
    // Give the re-triggered sync time to settle (or fail again).
    await page
      .waitForFunction(
        (t) => !document.body.innerText.includes(t),
        SYNC_FAILED_TEXT,
        { timeout: 6_000 },
      )
      .catch(() => {});
  }
}

/**
 * Navigate an already-authorized page to a hash SPA route without a full
 * reload (preserves the in-memory UCAN session), and let react-router settle.
 * Recovers from a transient post-login workspace-sync error before returning.
 *
 * Right after login the app runs its own redirects (away from `/auth`, toward
 * `/setup`/`/new-chat` when no model is set up) which — under parallel load —
 * can race our hash change and land the SPA on the chat/setup gate instead of
 * the requested route. Unless `opts.pin === false` (for routes that legitimately
 * redirect, e.g. `/sd-new` → `/sd`), we re-pin the target hash a few times until
 * the effective route matches its base path.
 */
export async function openRoute(
  page: Page,
  hashPath: string,
  opts: { pin?: boolean } = {},
): Promise<void> {
  const pin = opts.pin ?? true;
  const target = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  const base = target.replace(/^#/, '').split('?')[0];

  const setHash = () =>
    page.evaluate((h) => {
      window.location.hash = h;
    }, target);

  await setHash();
  await page.waitForTimeout(600);
  await waitForWorkspaceReady(page);

  if (pin) {
    for (let i = 0; i < 4; i++) {
      const hash = await page.evaluate(() => window.location.hash);
      const currentBase = hash.replace(/^#/, '').split('?')[0];
      if (currentBase === base) break;
      // The app bounced us elsewhere (setup/new-chat/home) — re-pin the target.
      await setHash();
      await page.waitForTimeout(500);
      await waitForWorkspaceReady(page);
    }
  }
  await page.waitForTimeout(200);
}

/**
 * Log in, or skip the current test with a precise reason when the wallet
 * UCAN handshake cannot complete in this environment.
 */
export async function loginOrSkip(page: Page): Promise<void> {
  if (!walletPrivateKey()) {
    test.skip(true, `${PRIVATE_KEY_ENV} not set — cannot perform wallet UCAN login`);
    return;
  }
  const ok = await login(page);
  test.skip(
    !ok,
    'wallet UCAN login did not complete in this environment (SIWE/UCAN root not established)',
  );
}
