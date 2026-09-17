/**
 * Shared login / auth helpers for the chat product e2e specs.
 *
 * `loginWithWallet` performs a REAL wallet-SIWE (UCAN) login through the app's
 * own auth page, backed by the injected EIP-1193 shim in chat-wallet.ts. No
 * backend faking: the app builds and persists a real root UCAN from a
 * personal_sign signature, workspace sync runs against the live WebDAV backend,
 * and the model bootstrap runs against the live Router. With no funded token,
 * the app lands the authorised user on `/setup` (no text model) with the
 * sidebar rendered — that is the real, expected state in this environment.
 */
import { expect, type Page } from '@playwright/test';
import { injectChatWallet, freshWalletKey } from './chat-wallet';

/** Locale-independent selector for the auth page primary "Sign In" button. */
export const AUTH_CONNECT = '[class*="auth-wallet-connect"]';
/** Locale-independent selector for the post-login sidebar. */
export const SIDEBAR = '[class*="home_sidebar"], [class*="sidebar"]';

export interface LoggedInWallet {
  address: string;
  privateKey: string;
}

/**
 * Inject a fresh wallet, drive the auth page, and wait until the app reports an
 * authorised session (redirected away from /auth and the sidebar mounted).
 * Returns the wallet address/key used.
 */
/** Text of the "Reload" retry button on the WorkspaceSyncError screen. */
const SYNC_RETRY = 'button:has-text("Reload")';

export async function loginWithWallet(page: Page): Promise<LoggedInWallet> {
  const privateKey = freshWalletKey();
  const address = await injectChatWallet(page, privateKey);
  await page.goto('/#/auth');
  await page.locator(AUTH_CONNECT).first().click();
  await expect
    .poll(async () => await isAuthorized(page), { timeout: 20_000, message: 'login authorised' })
    .toBe(true);
  // Sidebar renders once workspace + model bootstrap settle. Workspace sync
  // against the live WebDAV backend is occasionally flaky and surfaces a
  // "Failed to sync account data" screen with a Reload retry — click it and
  // keep waiting until the sidebar mounts.
  await waitForSidebar(page);
  return { address, privateKey };
}

/** Wait for the post-login sidebar, retrying transient workspace-sync errors. */
export async function waitForSidebar(page: Page, timeoutMs = 40_000): Promise<void> {
  const sidebar = page.locator(SIDEBAR).first();
  const retry = page.locator(SYNC_RETRY).first();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sidebar.isVisible().catch(() => false)) return;
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => {});
    }
    await page.waitForTimeout(500);
  }
  await sidebar.waitFor({ state: 'visible', timeout: 5_000 });
}

/** Read the app's own UCAN authorization verdict from within the page. */
export async function isAuthorized(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const exp = Number(localStorage.getItem('ucanRootExp'));
    const acct = localStorage.getItem('currentAccount');
    return Boolean(acct) && Number.isFinite(exp) && exp > Date.now();
  });
}
