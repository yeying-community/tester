/**
 * Helpers for launching a Chromium context with the wallet extension loaded.
 *
 * The wallet is a Chromium MV3 extension (`/Users/liuxin2/Workspace/opensource/wallet`)
 * loaded via `chromium.launchPersistentContext` + `--load-extension=<path>`.
 *
 * Why persistent context?
 *   1. MV3 service workers and extension state survive across launches only
 *      when they have a stable userDataDir.
 *   2. `chromium.launch` does not support `--load-extension` from a user
 *      script — only `launchPersistentContext` does.
 *
 * Why a fresh userDataDir per test?
 *   1. The wallet persists the keyring + accounts in chrome.storage.local,
 *      so reusing the dir across tests causes one test's wallet setup to
 *      leak into the next.
 *   2. The directory is small (a few KB of preferences) and gets cleaned up
 *      automatically.
 *
 * Each spec should call `loadWalletContext()` inside its test body, then
 * `await context.close()` in `afterEach`. There is no global setup hook
 * for the wallet (the SPA warmup in `scripts/global-setup.ts` doesn't
 * apply — `chrome-extension://` URLs don't respond to plain GET).
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, type BrowserContext, type LaunchOptions } from '@playwright/test';

const HEADED = process.env.PWHEADLESS === '0';
// Slow-motion delay (ms) between actions, so a headed run is watchable by
// eye. `PWSLOWMO=500` ≈ half a second per step. 0 = off. Wallet specs build
// their own persistent context here, so the config's launchOptions don't
// reach them — read the env directly.
const SLOW_MO = process.env.PWSLOWMO ? Number(process.env.PWSLOWMO) : 0;

export interface WalletContext {
  context: BrowserContext;
  userDataDir: string;
  extensionId: string;
}

export interface WalletContextOptions {
  /** Override headed/headless. Defaults to `PWHEADLESS !== '0'`. */
  headless?: boolean;
  /** Forwarded to chromium.launchPersistentContext. Defaults are sensible
   *  for MV3 extension loading; only override for debugging. */
  launchOptions?: Omit<LaunchOptions, 'headless' | 'channel' | 'args'>;
}

/**
 * Resolve the wallet extension source directory.
 *
 *   - `WALLET_EXTENSION_PATH` (preferred; matches the convention used by
 *     Playwright config) wins outright.
 *   - `WALLET_REPO_PATH` (matches marketplace/books) is the fallback.
 *   - Otherwise, throws with a hint.
 */
export function resolveWalletExtensionPath(): string {
  const fromEnv =
    process.env['WALLET_EXTENSION_PATH']?.trim() || process.env['WALLET_REPO_PATH']?.trim();
  if (!fromEnv) {
    throw new Error(
      'Wallet extension path not configured. Set WALLET_EXTENSION_PATH (preferred) ' +
        'or WALLET_REPO_PATH to the wallet source directory containing manifest.json.',
    );
  }
  if (!existsSync(fromEnv)) {
    throw new Error(`Wallet extension path does not exist: ${fromEnv}`);
  }
  if (!existsSync(join(fromEnv, 'manifest.json'))) {
    throw new Error(
      `Wallet extension path is missing manifest.json: ${fromEnv}. ` +
        'The directory must contain manifest.json for MV3 loading.',
    );
  }
  return fromEnv;
}

/**
 * Launch a persistent Chromium context with the wallet extension loaded
 * and resolve to the context + extension id + temp userDataDir.
 *
 * The caller is responsible for `await context.close()` and (optionally)
 * removing the userDataDir. Specs typically wrap this in `try/finally`
 * or `test.afterEach`.
 */
export async function loadWalletContext(options: WalletContextOptions = {}): Promise<WalletContext> {
  const extensionPath = resolveWalletExtensionPath();
  const headless = options.headless ?? !HEADED;
  const userDataDir = mkdtempSync(join(tmpdir(), 'yeying-wallet-e2e-'));

  // Mirrors the launch flags from
  // wallet/tests/e2e/extension-smoke.test.mjs (which is the source of
  // truth for this configuration).
  const launchOptions: LaunchOptions = {
    channel: 'chromium',
    headless,
    slowMo: SLOW_MO,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    ...options.launchOptions,
  };

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  // Service workers can take a moment to register on first launch; resolve
  // the extension id by waiting for one rather than racing the lookup.
  const extensionId = await getExtensionId(context);

  return { context, userDataDir, extensionId };
}

/**
 * Clean up after a `loadWalletContext()` call. Safe to call with a partially
 * initialised value (e.g. if launch throws).
 */
export async function teardownWalletContext(ctx: { context: BrowserContext; userDataDir: string }): Promise<void> {
  await ctx.context.close().catch(() => {
    // best-effort; the OS clears /tmp eventually
  });
  try {
    rmSync(ctx.userDataDir, { recursive: true, force: true });
  } catch {
    // ignore — tmp dir cleanup is best-effort
  }
}

/**
 * Resolve the extension id from its service worker.
 *
 * Ported from `wallet/tests/e2e/extension-smoke.test.mjs`. Most launches
 * expose the worker synchronously via `serviceWorkers()`, but on cold
 * starts we wait for it. Throws if the worker never appears.
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  const existing = context.serviceWorkers();
  if (existing.length > 0) {
    const id = new URL(existing[0]!.url()).host;
    if (/^[a-z]{32}$/.test(id)) return id;
  }
  const worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  const id = new URL(worker.url()).host;
  if (!/^[a-z]{32}$/.test(id)) {
    throw new Error(`Extension service worker did not expose a valid id: ${worker.url()}`);
  }
  return id;
}