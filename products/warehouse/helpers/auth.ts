/**
 * Warehouse auth helpers.
 *
 * Three auth strategies are supported, picked by which env vars are set:
 *   - password:        WAREHOUSE_USER + WAREHOUSE_PASS
 *   - bearer (cached): WAREHOUSE_AUTH_TOKEN
 *   - web3 wallet:     WAREHOUSE_WALLET_PRIVATE_KEY (signs SIWE challenge)
 *
 * UI 钱包登录（通过浏览器插件）单独在 ui-wallet.spec.ts 里处理。
 */
import { request } from '@playwright/test';
import { Wallet, Signature, getBytes, verifyMessage } from 'ethers';
import { envFor } from '../../../shared/env';

export interface WarehouseTokens {
  token: string;
  address: string;
  username: string;
  expiresAt: number;
  source: 'password' | 'cached' | 'wallet';
}

export async function loginWithPassword(baseURL: string): Promise<WarehouseTokens> {
  const env = envFor('warehouse');
  const username = env['WAREHOUSE_USER'];
  const password = env['WAREHOUSE_PASS'];
  if (!username || !password) {
    throw new Error('WAREHOUSE_USER and WAREHOUSE_PASS must be set to use password login');
  }
  const ctx = await request.newContext({ baseURL });
  let res;
  try {
    res = await ctx.post('/api/v1/public/auth/password/login', {
      data: { username, password },
    });
    const text = await res.text();
    if (res.status() !== 200) {
      throw new Error(`password login failed: ${res.status()} ${text}`);
    }
    const body = JSON.parse(text);
    return {
      token: body.data.token,
      address: body.data.address,
      username: body.data.username,
      expiresAt: body.data.expiresAt,
      source: 'password',
    };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Use a pre-issued JWT (cached or env-injected). Useful when a developer
 * already has a long-lived token from `pnpm env:check`'s `get-token` helper.
 */
export function loginWithCachedToken(token: string): WarehouseTokens {
  return {
    token,
    address: '',
    username: '',
    expiresAt: 0,
    source: 'cached',
  };
}

/**
 * Sign the SIWE challenge returned by /api/v1/public/auth/challenge. The
 * challenge message includes the nonce; we sign with `personal_sign`.
 */
export async function loginWithWallet(
  baseURL: string,
  privateKey: string,
): Promise<WarehouseTokens> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address.toLowerCase();

  const ctx = await request.newContext({ baseURL });
  try {
    const challengeRes = await ctx.post('/api/v1/public/auth/challenge', {
      data: { address },
    });
    const challengeText = await challengeRes.text();
    if (challengeRes.status() !== 200) {
      throw new Error(`challenge failed: ${challengeRes.status()} ${challengeText}`);
    }
    const challengeBody = JSON.parse(challengeText);
    const message: string = challengeBody.data.challenge;
    const signature = await wallet.signMessage(message);

    const verifyRes = await ctx.post('/api/v1/public/auth/verify', {
      data: { address, signature },
    });
    const verifyText = await verifyRes.text();
    if (verifyRes.status() !== 200) {
      throw new Error(`verify failed: ${verifyRes.status()} ${verifyText}`);
    }
    const body = JSON.parse(verifyText);
    return {
      token: body.data.token,
      address,
      username: '',
      expiresAt: body.data.expiresAt,
      source: 'wallet',
    };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Pick the best available login strategy and return a usable JWT.
 * Order: cached token → password → wallet.
 */
export async function acquireToken(baseURL: string): Promise<WarehouseTokens> {
  const env = envFor('warehouse');
  if (env['WAREHOUSE_AUTH_TOKEN']) {
    return loginWithCachedToken(env['WAREHOUSE_AUTH_TOKEN']);
  }
  if (env['WAREHOUSE_USER'] && env['WAREHOUSE_PASS']) {
    return loginWithPassword(baseURL);
  }
  if (env['WAREHOUSE_WALLET_PRIVATE_KEY']) {
    return loginWithWallet(baseURL, env['WAREHOUSE_WALLET_PRIVATE_KEY']);
  }
  throw new Error(
    'No warehouse credentials configured. Set WAREHOUSE_USER/PASS, WAREHOUSE_AUTH_TOKEN, or WAREHOUSE_WALLET_PRIVATE_KEY.',
  );
}

export async function authedRequest(baseURL: string, token: string) {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/** Re-export verifyMessage for tests that want to sanity-check signatures. */
export { Signature, getBytes, verifyMessage };
