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
import { Wallet, Signature, getAddress, getBytes, verifyMessage } from 'ethers';
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
  // The server's SIWE challenge/verify require an EIP-55 checksum address and
  // rejects all-lowercase input with 400 (see siwe.spec.ts). Sign with the
  // checksum form; the returned `address` is normalized to lowercase.
  const checksum = getAddress(wallet.address);

  // The backend keeps a single active challenge/nonce per address, so two
  // concurrent SIWE logins for the SAME wallet (parallel spec files) can clobber
  // each other's nonce and yield a transient "Signature verification failed".
  // Retry the whole challenge→sign→verify a few times with small jitter; every
  // attempt is a full real handshake (never faked).
  const maxAttempts = 5;
  let lastError = '';
  const ctx = await request.newContext({ baseURL });
  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const challengeRes = await ctx.post('/api/v1/public/auth/challenge', {
        data: { address: checksum },
      });
      const challengeText = await challengeRes.text();
      if (challengeRes.status() !== 200) {
        lastError = `challenge failed: ${challengeRes.status()} ${challengeText}`;
        await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 100)));
        continue;
      }
      const challengeBody = JSON.parse(challengeText);
      const message: string = challengeBody.data.challenge;
      const signature = await wallet.signMessage(message);

      const verifyRes = await ctx.post('/api/v1/public/auth/verify', {
        data: { address: checksum, signature },
      });
      const verifyText = await verifyRes.text();
      if (verifyRes.status() !== 200) {
        lastError = `verify failed: ${verifyRes.status()} ${verifyText}`;
        // 401 here is the transient nonce-clobber; back off and retry.
        await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
        continue;
      }
      const body = JSON.parse(verifyText);
      return {
        token: body.data.token,
        address,
        username: '',
        expiresAt: body.data.expiresAt,
        source: 'wallet',
      };
    }
    throw new Error(lastError || 'SIWE login failed');
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

export interface WarehouseUserInfo {
  username: string;
  walletAddress?: string;
  hasPassword: boolean;
  capabilities: { manageUsers: boolean };
}

/**
 * GET /api/v1/public/webdav/user/info. `capabilities.manageUsers` is true only
 * when the caller's wallet address is in the server's Security.AdminAddresses
 * allowlist — the authoritative gate for the admin-only endpoints.
 */
export async function getUserInfo(baseURL: string, token: string): Promise<WarehouseUserInfo> {
  const ctx = await authedRequest(baseURL, token);
  try {
    const res = await ctx.get('/api/v1/public/webdav/user/info');
    if (res.status() !== 200) {
      throw new Error(`user/info failed: ${res.status()} ${await res.text()}`);
    }
    const b = (await res.json()) as {
      username: string;
      wallet_address?: string;
      has_password?: boolean;
      capabilities?: { manageUsers?: boolean };
    };
    return {
      username: b.username,
      walletAddress: b.wallet_address,
      hasPassword: Boolean(b.has_password),
      capabilities: { manageUsers: Boolean(b.capabilities?.manageUsers) },
    };
  } finally {
    await ctx.dispose();
  }
}

/** Re-export verifyMessage for tests that want to sanity-check signatures. */
export { Signature, getBytes, verifyMessage };
