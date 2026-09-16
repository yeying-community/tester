/**
 * Browser-side session helpers for warehouse UI tests.
 *
 * `seedAuthenticatedSession(page, baseURL, privateKey)` runs the classical
 * SIWE flow (challenge -> personal_sign -> verify) inside the browser to
 * obtain a real JWT, then writes the JWT + wallet address into every slot
 * the SDK reads on page load:
 *
 *   - `localStorage['authToken']`       (DEFAULT_TOKEN_KEY in @yeying-community/web3-bs)
 *   - `document.cookie` (`authToken=...`)
 *   - `localStorage['currentAccount']`
 *   - `localStorage['walletAddress']`
 *   - `localStorage['warehouse:accountHistory']`
 *
 * After the writes the page is reloaded so `initializeAuthSession()`
 * hydrates the SDK's in-memory token from localStorage + cookie, flipping
 * the frontend's `isAuth` reactive flag. The function returns the seeded
 * `{address, token}` so individual tests can assert against them.
 *
 * Notes:
 *   - The wallet signer is exposed via `exposeWalletSigner` so the
 *     private key never enters the page context.
 *   - The function expects the page to already be navigated to `baseURL`.
 *     Calling it before `page.goto(baseURL)` will fail because the
 *     challenge endpoint is on the same origin as the SPA.
 *   - Address casing follows the SIWE challenge contract: the address is
 *     sent to `/challenge` in **EIP-55 checksum** form (warehouse requires
 *     it; the challenge message then embeds it in lowercase).
 */
import type { Page } from '@playwright/test';
import { Wallet, getAddress } from 'ethers';
import { exposeWalletSigner } from './wallet';

export interface SeededSession {
  token: string;
  address: string; // lowercase, as returned by ethers.Wallet
}

/**
 * Seed a logged-in warehouse UI session from a SIWE challenge -> verify
 * round-trip, then reload the page so the SDK picks up the token.
 *
 * @param page        Playwright page (must have already navigated to `baseURL`).
 * @param baseURL     Frontend origin (e.g. `http://localhost:5173`).
 * @param privateKey  Hex-encoded private key (with or without `0x` prefix).
 */
export async function seedAuthenticatedSession(
  page: Page,
  baseURL: string,
  privateKey: string,
): Promise<SeededSession> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address;
  const checksum = getAddress(address);

  // Expose Node-side personal_sign so the browser can sign without a wallet.
  await exposeWalletSigner(page, wallet);

  const result = await page.evaluate(
    async ({ apiBase, addr }: { apiBase: string; addr: string }) => {
      const cRes = await fetch(`${apiBase}/api/v1/public/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      if (!cRes.ok) throw new Error(`challenge ${cRes.status}`);
      const cBody = (await cRes.json()) as { data: { challenge: string } };
      const message: string = cBody.data.challenge;
      const signature: string = await (globalThis as unknown as {
        __e2e_signPersonal: (m: string) => Promise<string>;
      }).__e2e_signPersonal(message);
      const vRes = await fetch(`${apiBase}/api/v1/public/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature }),
      });
      if (!vRes.ok) throw new Error(`verify ${vRes.status}`);
      const vBody = (await vRes.json()) as { data: { token: string } };
      const token: string = vBody.data.token;

      // Mirror what the SDK's login flow writes on a real login so the
      // post-reload bootstrap picks up the session. This runs inside the
      // page (browser) context; the test tsconfig omits the DOM lib, so
      // reach the browser globals through `globalThis as any`.
      const g = globalThis as any;
      g.localStorage.setItem('authToken', token);
      g.document.cookie = `authToken=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
      g.localStorage.setItem('currentAccount', addr);
      g.localStorage.setItem('walletAddress', addr);
      try {
        g.localStorage.setItem(
          'warehouse:accountHistory',
          JSON.stringify([{ address: addr, lastUsedAt: Date.now() }]),
        );
      } catch (_) {
        // localStorage quota / serialization edge cases — non-fatal.
      }
      // Tell any listeners that auth state changed.
      g.dispatchEvent(new g.CustomEvent('warehouse:auth-changed'));
      return { token, address: addr };
    },
    { apiBase: baseURL, addr: checksum },
  );

  // Reload so initializeAuthSession() reads the cookie + localStorage.
  // The warehouse SPA makes continuous background requests (SDK polling,
  // webdav health pings, etc.) so `networkidle` never fires — use
  // `domcontentloaded` and let the test wait for the post-login DOM
  // (`.side-panel` / `.right .task-button`) before asserting.
  await page.reload({ waitUntil: 'domcontentloaded' });

  return { token: result.token, address };
}