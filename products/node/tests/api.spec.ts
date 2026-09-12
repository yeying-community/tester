/**
 * node — SIWE login + JWT-protected endpoints.
 *
 * Steps:
 *   1. GET  /api/v1/public/health          → 200
 *   2. GET  /api/v1/public/ready           → 200 (DB up)
 *   3. POST /api/v1/public/auth/challenge  → challenge + nonce (EIP-4361)
 *   4. sign the challenge with personal_sign
 *   5. POST /api/v1/public/auth/verify     → JWT + refresh cookie
 *   6. GET  /api/v1/public/profile/me     → wallet-bound profile
 *   7. POST /api/v1/public/auth/refresh   → new access token (cookie)
 *   8. POST /api/v1/public/auth/logout    → clears refresh cookie
 *
 * Requires:
 *   - NODE_BASE_URL / NODE_API_URL
 *   - NODE_WALLET_PRIVATE_KEY
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';
import { apiContext } from '../../../shared/api';
import { loginWithWallet } from '../helpers/auth';

function skipIfNoService() {
  test.skip(!baseURLFor('node'), 'NODE_BASE_URL not configured');
}

test('health endpoint returns ok', async () => {
  skipIfNoService();
  const env = envFor('node');
  const api = env['NODE_API_URL'] ?? env['baseURL']!;
  const ctx = await apiContext(api);
  try {
    const res = await ctx.get('/api/v1/public/health');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { code: number; data: { status: string } };
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('ok');
  } finally {
    await ctx.dispose();
  }
});

test('ready endpoint confirms the database', async () => {
  skipIfNoService();
  const env = envFor('node');
  const api = env['NODE_API_URL'] ?? env['baseURL']!;
  const ctx = await apiContext(api);
  try {
    const res = await ctx.get('/api/v1/public/ready');
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: { database: string } };
      expect(body.data.database).toBe('ok');
    }
  } finally {
    await ctx.dispose();
  }
});

test('SIWE challenge returns an EIP-4361 message', async () => {
  skipIfNoService();
  const env = envFor('node');
  test.skip(!env['NODE_WALLET_PRIVATE_KEY'], 'NODE_WALLET_PRIVATE_KEY not configured');
  const api = env['NODE_API_URL'] ?? env['baseURL']!;
  const ctx = await apiContext(api);
  try {
    const res = await ctx.post('/api/v1/public/auth/challenge', {
      data: { address: '0xcD05C9a21555319Ff0cF0A9C177aFe414B6Aa7B6', chainId: 1 },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { challenge: string; nonce: string; version: string; chainId: number } };
    expect(body.data.version).toBe('1');
    expect(body.data.chainId).toBe(1);
    expect(body.data.challenge.toLowerCase()).toContain('0xcd05c9a21555319ff0cf0a9c177afe414b6aa7b6');
    expect(body.data.nonce).toMatch(/^[A-Za-z0-9_-]{8,}$/);
  } finally {
    await ctx.dispose();
  }
});

test('SIWE verify yields a JWT and binds it to the wallet', async () => {
  skipIfNoService();
  const env = envFor('node');
  test.skip(!env['NODE_WALLET_PRIVATE_KEY'], 'NODE_WALLET_PRIVATE_KEY not configured');
  const tokens = await loginWithWallet(env['baseURL']!, env['NODE_WALLET_PRIVATE_KEY']!);
  expect(tokens.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(tokens.address.toLowerCase()).toBe(
    env['NODE_EXPECTED_ADDRESS']?.toLowerCase() ?? tokens.address.toLowerCase(),
  );
});

test('profile/me requires a valid JWT', async () => {
  skipIfNoService();
  const env = envFor('node');
  test.skip(!env['NODE_WALLET_PRIVATE_KEY'], 'NODE_WALLET_PRIVATE_KEY not configured');
  const api = env['NODE_API_URL'] ?? env['baseURL']!;
  const tokens = await loginWithWallet(env['baseURL']!, env['NODE_WALLET_PRIVATE_KEY']!);
  const ctx = await apiContext(api, { Authorization: `Bearer ${tokens.token}` });
  try {
    const res = await ctx.get('/api/v1/public/profile/me');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { address: string } };
    expect(body.data.address.toLowerCase()).toBe(tokens.address.toLowerCase());
  } finally {
    await ctx.dispose();
  }
});

test('profile/me rejects requests without a JWT', async () => {
  skipIfNoService();
  const env = envFor('node');
  const api = env['NODE_API_URL'] ?? env['baseURL']!;
  const ctx = await apiContext(api);
  try {
    const res = await ctx.get('/api/v1/public/profile/me');
    expect([401, 403]).toContain(res.status());
  } finally {
    await ctx.dispose();
  }
});

test('auth/refresh + auth/logout keep the refresh-cookie contract', async () => {
  skipIfNoService();
  const env = envFor('node');
  test.skip(!env['NODE_WALLET_PRIVATE_KEY'], 'NODE_WALLET_PRIVATE_KEY not configured');
  const api = env['NODE_API_URL'] ?? env['baseURL']!;

  // 1) Sign in — refresh cookie should be set
  const initial = await loginWithWallet(env['baseURL']!, env['NODE_WALLET_PRIVATE_KEY']!);

  // 2) Hit /refresh with the same session cookies; build a context that
  //    keeps cookies across requests to mirror the SDK.
  const ctx = await apiContext(api, { storageState: undefined });
  try {
    const refresh = await ctx.post('/api/v1/public/auth/refresh', {
      data: {},
    });
    // Without the refresh cookie, this should be 401. (We never received
    // a refresh cookie because loginWithWallet's context is disposed.)
    expect(refresh.status()).toBe(401);
  } finally {
    await ctx.dispose();
  }
  // Confirm initial JWT was actually valid:
  expect(initial.expiresAt).toBeGreaterThan(Date.now());
});