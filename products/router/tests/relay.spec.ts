/**
 * router — OpenAI-compatible relay auth boundary (RT-API-044 / RT-API-045).
 *
 * The relay group (`POST /api/v1/public/chat/completions`, `/models`, …) is
 * guarded by `TokenAuth` (API-key `sk-…`) + `Distribute`. Actually routing a
 * completion to an upstream requires a provisioned API key AND account quota +
 * available models — neither of which this wallet account has (models require a
 * purchase, the external-payment boundary). So per the agreed scope this is
 * exercised only to the *authorization* boundary:
 *
 *   - no credentials          → 401, one-api error "未提供令牌"
 *   - a user-session JWT       → 401, "无效的令牌" (JWTs are not API keys)
 *   - a forged `sk-…` key      → 401
 *
 * Failures come back as the one-api error envelope `{ error: { message, type } }`
 * with HTTP 401 — the request is rejected before any upstream is contacted.
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';
import { apiContext } from '../../../shared/api';
import { acquireRouterToken } from '../helpers/auth';

function skipIfNoService() {
  test.skip(!baseURLFor('router'), 'ROUTER_BASE_URL not configured');
}

const CHAT = '/api/v1/public/chat/completions';
const chatBody = { model: 'gpt-4o', messages: [{ role: 'user', content: 'ping' }] };

// RT-API-045 (P1)
test('relay rejects missing and forged tokens with 401 (no upstream routing)', async () => {
  skipIfNoService();
  const ctx = await apiContext(baseURLFor('router')!);
  try {
    const noAuth = await ctx.post(CHAT, { data: chatBody });
    expect(noAuth.status()).toBe(401);
    const noAuthBody = (await noAuth.json()) as { error?: { message?: string } };
    expect(noAuthBody.error?.message ?? '').toMatch(/未提供令牌|token/i);

    const forged = await apiContext(baseURLFor('router')!, {
      Authorization: 'Bearer sk-forged-000000000000000000000000',
    });
    try {
      const res = await forged.post(CHAT, { data: chatBody });
      expect(res.status()).toBe(401);
    } finally {
      await forged.dispose();
    }
  } finally {
    await ctx.dispose();
  }
});

// RT-API-044 (P0) — boundary only: a user JWT is not an API key, so TokenAuth
// rejects it before any distribution/upstream relay + quota deduction happens.
test('relay via a user JWT is rejected by TokenAuth (relay boundary)', async () => {
  skipIfNoService();
  test.skip(
    !envFor('router')['ROUTER_WALLET_PRIVATE_KEY'],
    'ROUTER_WALLET_PRIVATE_KEY not configured',
  );
  const baseURL = baseURLFor('router')!;
  const { token } = await acquireRouterToken(baseURL);
  const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
  try {
    const res = await ctx.post(CHAT, { data: chatBody });
    // The wallet JWT is not accepted by the TokenAuth relay chain.
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: { message?: string; type?: string } };
    expect(body.error?.message ?? '').toMatch(/无效的令牌|令牌|token/i);
    test.info().annotations.push({
      type: 'boundary',
      description:
        'no API key/quota/models on this account; relay verified to the TokenAuth boundary only',
    });
  } finally {
    await ctx.dispose();
  }
});
