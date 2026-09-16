/**
 * Browser-side session helper for node UI tests.
 *
 * Unlike warehouse (which runs SIWE in-page via an exposed signer), node's
 * `loginWithWallet` already performs the challenge -> sign -> verify round
 * trip in Node and hands back a real access JWT. So we acquire the token in
 * Node, then write it into every localStorage slot the node SPA reads on
 * boot and reload the page so `initializeAuthSession()` hydrates state:
 *
 *   - `authToken`            — the access JWT (web/src/plugins/auth.ts)
 *   - `authTokenExpiresAt`   — exp*1000 (ms); best-effort, not read for
 *                              validity (readStoredAuthToken re-derives from
 *                              the JWT), but the SPA persists it on real login
 *   - `currentAccount`       — checksummed wallet address
 *   - `hasConnectedWallet`   — 'true' (walletReady store; /market is gated on it)
 *
 * The access token's `typ` claim is 'access' (node src/auth/siwe.ts), which
 * is what `isJwtTokenFresh` requires — so the seeded token survives the
 * post-reload freshness check.
 */
import type { Page } from '@playwright/test';
import { getAddress } from 'ethers';

import { loginWithWallet } from './auth';

export interface SeededNodeSession {
  token: string;
  address: string; // checksummed
}

/** Decode a JWT's `exp` (seconds) → epoch ms, or 0 if unavailable. */
function jwtExpiresAtMs(token: string): number {
  const part = token.split('.')[1];
  if (!part) return 0;
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Seed a logged-in node UI session from a real SIWE login, then reload so
 * the SPA picks up the token.
 *
 * @param page        Playwright page (must have already navigated to `baseURL`).
 * @param baseURL     Frontend origin (e.g. `http://localhost:8100`).
 * @param privateKey  Hex-encoded private key (with or without `0x` prefix).
 */
export async function seedWalletSession(
  page: Page,
  baseURL: string,
  privateKey: string,
): Promise<SeededNodeSession> {
  const tokens = await loginWithWallet(baseURL, privateKey);
  const address = getAddress(tokens.address);
  const expiresAtMs = jwtExpiresAtMs(tokens.token) || Number(tokens.expiresAt) || 0;

  await page.evaluate(
    ({ token, addr, expiresAt }: { token: string; addr: string; expiresAt: number }) => {
      const g = globalThis as any;
      g.localStorage.setItem('authToken', token);
      if (expiresAt > 0) {
        g.localStorage.setItem('authTokenExpiresAt', String(expiresAt));
      }
      g.localStorage.setItem('currentAccount', addr);
      g.localStorage.setItem('hasConnectedWallet', 'true');
    },
    { token: tokens.token, addr: address, expiresAt: expiresAtMs },
  );

  await page.reload({ waitUntil: 'domcontentloaded' });

  return { token: tokens.token, address };
}
