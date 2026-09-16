/**
 * Browser-side session helper for router UI tests.
 *
 * Router's `loginWithWallet` performs the custom challenge -> sign -> verify
 * round trip in Node and returns an access token. The real SPA login then
 * calls `GET /api/v1/public/user/self` and caches the user object. We mirror
 * that here: acquire the token in Node, fetch `user/self`, then write every
 * localStorage slot the SPA reads on boot and reload:
 *
 *   - `wallet_token`             — access token (helpers/web3.jsx WEB3_TOKEN_STORAGE_KEY)
 *   - `wallet_token_expires_at`  — ISO string (services/web3Auth.jsx)
 *   - `user`                     — JSON { ...userSelf, token } (PrivateRoute gate +
 *                                  auth-header.jsx read this)
 *
 * `PrivateRoute` only checks `localStorage.getItem('user')` is present, and
 * `authHeader()` / the axios interceptor send `Bearer user.token`, so seeding
 * these three keys yields a fully authenticated workspace session.
 */
import { request } from '@playwright/test';
import type { Page } from '@playwright/test';

import { envFor } from '../../../shared/env';
import { loginWithWallet, type RouterTokens } from './auth';

export interface SeededRouterSession {
  token: string;
  userId: string;
  address: string;
  /** Parsed user object as cached under localStorage['user']. */
  user: Record<string, unknown>;
}

/**
 * Seed a logged-in router workspace session, then reload so the SPA picks
 * up the token.
 *
 * @param page        Playwright page (must have already navigated to `baseURL`).
 * @param baseURL     Frontend origin (e.g. `http://localhost:3000`).
 * @param privateKey  Optional; defaults to `ROUTER_WALLET_PRIVATE_KEY` from env.
 */
export async function seedWalletSession(
  page: Page,
  baseURL: string,
  privateKey?: string,
): Promise<SeededRouterSession> {
  const pk = privateKey ?? envFor('router')['ROUTER_WALLET_PRIVATE_KEY'];
  if (!pk) {
    throw new Error('ROUTER_WALLET_PRIVATE_KEY is required to seed a router session');
  }
  const tokens: RouterTokens = await loginWithWallet(baseURL, pk);

  // Fetch the user object exactly as the SPA does after wallet login.
  const ctx = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${tokens.token}` },
  });
  let userSelf: Record<string, unknown>;
  try {
    const res = await ctx.get('/api/v1/public/user/self');
    if (res.status() !== 200) {
      throw new Error(`user/self failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
    if (!body.data) {
      throw new Error('user/self returned no data');
    }
    userSelf = body.data;
  } finally {
    await ctx.dispose();
  }

  const user = { ...userSelf, token: tokens.token };
  const expiresIso = new Date(tokens.expiresAt * 1000).toISOString();

  await page.evaluate(
    ({ token, expiresAt, userJson }: { token: string; expiresAt: string; userJson: string }) => {
      const g = globalThis as any;
      g.localStorage.setItem('wallet_token', token);
      g.localStorage.setItem('wallet_token_expires_at', expiresAt);
      g.localStorage.setItem('user', userJson);
    },
    { token: tokens.token, expiresAt: expiresIso, userJson: JSON.stringify(user) },
  );

  await page.reload({ waitUntil: 'domcontentloaded' });

  return { token: tokens.token, userId: tokens.userId, address: tokens.address, user };
}
