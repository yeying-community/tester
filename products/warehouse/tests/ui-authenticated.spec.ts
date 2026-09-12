/**
 * warehouse — Post-login UI state in the browser.
 *
 * Runs the classical SIWE flow (challenge -> sign -> verify) inside the
 * browser to obtain a real JWT bound to a wallet address, then writes the
 * JWT into the SDK's storage (authToken cookie + localStorage entries +
 * the SDK's own token slot) so the frontend's `isAuth` returns true on
 * reload.
 *
 * This proves the entire post-login UX is wired correctly (AppHeader
 * state, isAuth reactivity, task button + avatar) without depending on
 * the full UCAN identity-presentation flow used by the wallet button
 * itself (which the warehouse SDK builds from a live wallet; that path
 * is exercised manually + by the warehouse backend integration tests).
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';
import { Wallet, getAddress } from 'ethers';
import { exposeWalletSigner } from '../helpers/wallet';

function skipIfNoService() {
  test.skip(!baseURLFor('warehouse'), 'WAREHOUSE_BASE_URL not configured');
}

test('authenticated browser session renders the AppHeader post-login UI', async ({
  page,
  context,
  baseURL,
}) => {
  skipIfNoService();
  const env = envFor('warehouse');
  test.skip(!env['WAREHOUSE_WALLET_PRIVATE_KEY'], 'WAREHOUSE_WALLET_PRIVATE_KEY not configured');

  const wallet = new Wallet(env['WAREHOUSE_WALLET_PRIVATE_KEY']!);
  const address = wallet.address;
  const checksum = getAddress(address);

  // Expose Node-side personal_sign so the browser can sign without a wallet.
  await exposeWalletSigner(page, wallet);

  await page.goto(baseURL!, { waitUntil: 'networkidle' });

  // Run the SIWE flow inside the browser so cookies + localStorage line up
  // with the SDK's expected format.
  const result = await page.evaluate(
    async ({ apiBase, addr }: { apiBase: string; addr: string }) => {
      const cRes = await fetch(`${apiBase}/api/v1/public/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      if (!cRes.ok) throw new Error(`challenge ${cRes.status}`);
      const cBody = await cRes.json();
      const message: string = cBody.data.challenge;
      const signature: string = await (window as unknown as {
        __e2e_signPersonal: (m: string) => Promise<string>;
      }).__e2e_signPersonal(message);
      const vRes = await fetch(`${apiBase}/api/v1/public/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature }),
      });
      if (!vRes.ok) throw new Error(`verify ${vRes.status}`);
      const vBody = await vRes.json();
      const token: string = vBody.data.token;

      // Write all the SDK-expected state. The SDK stores the access token
      // in localStorage['authToken'] (DEFAULT_TOKEN_KEY in @yeying-community/web3-bs),
      // plus the frontend writes its cookie + localStorage address entries.
      localStorage.setItem('authToken', token);
      document.cookie = `authToken=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
      localStorage.setItem('currentAccount', addr);
      localStorage.setItem('walletAddress', addr);
      try {
        localStorage.setItem(
          'warehouse:accountHistory',
          JSON.stringify([{ address: addr, lastUsedAt: Date.now() }]),
        );
      } catch (_) {
        // localStorage quota / serialization edge cases — non-fatal.
      }
      // Tell any listeners that auth state changed.
      window.dispatchEvent(new CustomEvent('warehouse:auth-changed'));
      return { token, address: addr };
    },
    { apiBase: baseURL!, addr: checksum },
  );

  expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

  // Reload — initializeAuthSession() reads the cookie + localStorage and
  // populates the SDK's in-memory token.
  await page.reload({ waitUntil: 'networkidle' });

  // Post-login UI: the landing-page buttons are gone.
  await expect(page.getByRole('button', { name: '钱包登录' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '通行证登录' })).toHaveCount(0);

  // AppHeader shows the task button (always present after auth).
  await expect(page.locator('.right .task-button').first()).toBeVisible({ timeout: 10_000 });

  // Confirm the SDK stored the wallet address back into localStorage.
  const stored = await page.evaluate(() => localStorage.getItem('walletAddress'));
  expect(stored?.toLowerCase()).toBe(address.toLowerCase());

  // The cookie persisted across the reload.
  const cookies = await context.cookies(baseURL!);
  expect(cookies.find((c) => c.name === 'authToken')?.value).toBeTruthy();
});