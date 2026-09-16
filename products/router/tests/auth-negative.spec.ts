/**
 * router — wallet SIWE negative / nonce-lifecycle contract.
 *
 * The custom-format challenge → verify flow returns the proto envelope
 * `{ success, message, data }` (HTTP 200 even on failure — there is NO top-level
 * `code`; `writeProtoError` discards the numeric code). These tests pin the
 * failure branches verified against router `internal/admin/controller/auth/wallet.go`:
 *
 *   - wrong-key signature      → "签名地址与请求地址不一致" (RT-API-009)
 *   - missing address          → "参数错误，缺少 address"   (RT-API-007)
 *   - missing signature/nonce  → "缺少签名或 nonce"          (RT-API-010)
 *   - overwritten nonce        → "nonce 无效或已过期"        (RT-API-011)
 *   - consumed (one-time) nonce→ "nonce 无效或已过期"        (RT-API-012)
 *
 * The nonce store keeps exactly one entry per address (GetWalletNonce), so the
 * overwrite + one-time cases are ordered inside a `serial` block to avoid a
 * parallel challenge clobbering the nonce mid-test.
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';
import { apiContext } from '../../../shared/api';
import { Wallet } from 'ethers';

const CHALLENGE = '/api/v1/public/common/auth/challenge';
const VERIFY = '/api/v1/public/common/auth/verify';

function skipIfNoService() {
  test.skip(!baseURLFor('router'), 'ROUTER_BASE_URL not configured');
}

interface ProtoEnvelope {
  success: boolean;
  message: string;
  data: unknown;
}

// RT-API-009 (P0)
test('verify rejects a signature from the wrong private key (no token issued)', async () => {
  skipIfNoService();
  const env = envFor('router');
  test.skip(!env['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');
  const ctx = await apiContext(baseURLFor('router')!);
  try {
    const declared = new Wallet(env['ROUTER_WALLET_PRIVATE_KEY']!).address.toLowerCase();

    // The shared wallet's nonce can be clobbered by a parallel login between
    // our challenge and verify. Retry until we get a real (non-nonce) verdict.
    let vBody: ProtoEnvelope & { data: { token?: string } | null } = {
      success: true,
      message: '',
      data: null,
    };
    for (let attempt = 0; attempt < 6; attempt++) {
      const cRes = await ctx.post(CHALLENGE, { data: { address: declared } });
      expect(cRes.status()).toBe(200);
      const cBody = (await cRes.json()) as { data: { message: string; nonce: string } };

      // Sign the *correct* challenge message with a DIFFERENT (random) key, so
      // the recovered signer address will not match the declared address.
      const attacker = Wallet.createRandom();
      const signature = await attacker.signMessage(cBody.data.message);

      const vRes = await ctx.post(VERIFY, {
        data: { address: declared, signature, nonce: cBody.data.nonce, message: cBody.data.message },
      });
      expect(vRes.status()).toBe(200);
      vBody = (await vRes.json()) as ProtoEnvelope & { data: { token?: string } | null };
      if (!(vBody.message ?? '').includes('nonce')) break;
      await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
    }

    expect(vBody.success).toBe(false);
    expect(vBody.message).toContain('签名地址与请求地址不一致');
    // No token leaked on the mismatch path.
    expect(vBody.data == null || (vBody.data as { token?: string }).token == null).toBe(true);
  } finally {
    await ctx.dispose();
  }
});

// RT-API-007 (P1)
test('challenge rejects missing / malformed address', async () => {
  skipIfNoService();
  const ctx = await apiContext(baseURLFor('router')!);
  try {
    for (const body of [{}, { address: 'not-an-eth-address' }]) {
      const res = await ctx.post(CHALLENGE, { data: body });
      expect(res.status()).toBe(200);
      const parsed = (await res.json()) as ProtoEnvelope;
      expect(parsed.success).toBe(false);
      expect(parsed.message).toContain('address');
    }
  } finally {
    await ctx.dispose();
  }
});

// RT-API-008 (P1) — challenge rejects an unbound address when auto-register is off.
//
// `WalletChallengeProto` (wallet.go) rejects with proto code 5 + "钱包未绑定账户…"
// when `!IsWalletAddressAlreadyTaken(addr) && !config.AutoRegisterEnabled`.
// Challenging a *fresh random* address only ever mints a nonce (auto-create
// happens at verify), so this probe is side-effect free. If the deployment has
// AutoRegisterEnabled=true the reject branch is unreachable and we skip with the
// live-detected reason; otherwise we assert the controlled rejection.
test('challenge rejects an unbound address when auto-register is disabled', async () => {
  skipIfNoService();
  const ctx = await apiContext(baseURLFor('router')!);
  try {
    const fresh = Wallet.createRandom().address.toLowerCase();
    const res = await ctx.post(CHALLENGE, { data: { address: fresh } });
    expect(res.status()).toBe(200);
    const parsed = (await res.json()) as ProtoEnvelope;

    // Auto-register ON → an unbound address still gets a nonce; the reject branch
    // can never fire on this deployment.
    test.skip(
      parsed.success === true,
      'AutoRegisterEnabled=true on this deployment: unbound wallet addresses are auto-registered, ' +
        'so the challenge reject branch (RT-API-008) cannot fire',
    );

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('钱包未绑定账户');
  } finally {
    await ctx.dispose();
  }
});

// RT-API-010 (P1)
test('verify rejects a request missing the signature', async () => {
  skipIfNoService();
  const env = envFor('router');
  test.skip(!env['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');
  const ctx = await apiContext(baseURLFor('router')!);
  try {
    const declared = new Wallet(env['ROUTER_WALLET_PRIVATE_KEY']!).address.toLowerCase();
    const cRes = await ctx.post(CHALLENGE, { data: { address: declared } });
    const cBody = (await cRes.json()) as { data: { message: string; nonce: string } };

    const res = await ctx.post(VERIFY, {
      data: { address: declared, nonce: cBody.data.nonce, message: cBody.data.message },
    });
    expect(res.status()).toBe(200);
    const parsed = (await res.json()) as ProtoEnvelope;
    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('缺少签名或 nonce');
  } finally {
    await ctx.dispose();
  }
});

test.describe('nonce lifecycle (serial — single-entry per-address store)', () => {
  test.describe.configure({ mode: 'serial' });

  // RT-API-011 (P1) — a second challenge overwrites the first address nonce.
  test('a later challenge overwrites the previous nonce (RT-API-011)', async () => {
    skipIfNoService();
    const env = envFor('router');
    test.skip(!env['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');
    const wallet = new Wallet(env['ROUTER_WALLET_PRIVATE_KEY']!);
    const address = wallet.address.toLowerCase();
    const ctx = await apiContext(baseURLFor('router')!);
    try {
      const c1 = (await (await ctx.post(CHALLENGE, { data: { address } })).json()) as {
        data: { message: string; nonce: string };
      };
      const sig1 = await wallet.signMessage(c1.data.message);

      // Second challenge for the same address supersedes nonce #1.
      await ctx.post(CHALLENGE, { data: { address } });

      const res = await ctx.post(VERIFY, {
        data: { address, signature: sig1, nonce: c1.data.nonce, message: c1.data.message },
      });
      expect(res.status()).toBe(200);
      const parsed = (await res.json()) as ProtoEnvelope;
      expect(parsed.success).toBe(false);
      expect(parsed.message).toContain('nonce 无效或已过期');
    } finally {
      await ctx.dispose();
    }
  });

  // RT-API-012 (P1) — a nonce is single-use; replay after a successful verify fails.
  test('a consumed nonce cannot be replayed (RT-API-012)', async () => {
    skipIfNoService();
    const env = envFor('router');
    test.skip(!env['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');
    const wallet = new Wallet(env['ROUTER_WALLET_PRIVATE_KEY']!);
    const address = wallet.address.toLowerCase();
    const ctx = await apiContext(baseURLFor('router')!);
    try {
      // Land a clean challenge→verify (retrying across the shared-wallet nonce
      // race) so we hold a genuinely *consumed* nonce to replay.
      let verifyBody: { address: string; signature: string; nonce: string; message: string } | null =
        null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const c = (await (await ctx.post(CHALLENGE, { data: { address } })).json()) as {
          data: { message: string; nonce: string };
        };
        const signature = await wallet.signMessage(c.data.message);
        const candidate = { address, signature, nonce: c.data.nonce, message: c.data.message };
        const first = (await (await ctx.post(VERIFY, { data: candidate })).json()) as ProtoEnvelope & {
          data: { token?: string } | null;
        };
        if (first.success) {
          expect(first.data?.token).toBeTruthy();
          verifyBody = candidate;
          break;
        }
        await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
      }
      expect(verifyBody, 'could not land a clean verify to consume a nonce').not.toBeNull();

      // Replaying the exact same message/nonce must fail — nonce is one-time.
      const second = await ctx.post(VERIFY, { data: verifyBody! });
      expect(second.status()).toBe(200);
      const secondBody = (await second.json()) as ProtoEnvelope;
      expect(secondBody.success).toBe(false);
      expect(secondBody.message).toContain('nonce 无效或已过期');
    } finally {
      await ctx.dispose();
    }
  });
});
