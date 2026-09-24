/**
 * Router auth helpers.
 *
 * Router uses a custom (non-EIP-4361) challenge format. The login flow:
 *   POST /api/v1/public/common/auth/challenge  →  { data: { message, nonce, ... } }
 *   POST /api/v1/public/common/auth/verify     →  { data: { token, user: {...} } }
 *
 * The verifier accepts any case for the address field; we use lowercase.
 */
import { request } from '@playwright/test';
import { Wallet } from 'ethers';
import { envFor } from '../../../shared/env';

export interface RouterTokens {
  token: string;
  userId: string;
  address: string;
  expiresAt: number;
}

export async function loginWithWallet(
  baseURL: string,
  privateKey: string,
): Promise<RouterTokens> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address.toLowerCase();

  const ctx = await request.newContext({ baseURL });
  try {
    // The router nonce store keeps exactly one nonce per address (GetWalletNonce),
    // so when several tests log in concurrently with the same wallet a parallel
    // challenge can clobber this attempt's nonce before verify consumes it,
    // yielding "nonce 无效或已过期". Retry the whole challenge→sign→verify a few
    // times with jitter to ride out that documented single-slot race.
    let lastErr = '';
    for (let attempt = 0; attempt < 6; attempt++) {
      const cRes = await ctx.post('/api/v1/public/common/auth/challenge', {
        data: { address },
      });
      if (cRes.status() !== 200) {
        throw new Error(`challenge failed: ${cRes.status()} ${await cRes.text()}`);
      }
      const cBody = (await cRes.json()) as {
        data: { message: string; nonce: string };
      };
      const signature = await wallet.signMessage(cBody.data.message);

      const vRes = await ctx.post('/api/v1/public/common/auth/verify', {
        data: {
          address,
          signature,
          nonce: cBody.data.nonce,
          message: cBody.data.message,
        },
      });
      const vText = await vRes.text();
      if (vRes.status() !== 200) {
        throw new Error(`verify failed: ${vRes.status()} ${vText}`);
      }
      const vBody = JSON.parse(vText) as {
        success?: boolean;
        message?: string;
        data: {
          token: string;
          user: { id: string };
          expires_at: string;
        } | null;
      };
      if (vBody.data) {
        return {
          token: vBody.data.token,
          userId: vBody.data.user.id,
          address,
          expiresAt: Math.floor(new Date(vBody.data.expires_at).getTime() / 1000),
        };
      }
      lastErr = vText;
      // Only the nonce race is transient; anything else is a hard failure.
      if (!(vBody.message ?? '').includes('nonce')) {
        throw new Error(`verify returned null data: ${vText}`);
      }
      await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
    }
    throw new Error(`verify kept failing on nonce race: ${lastErr}`);
  } finally {
    await ctx.dispose();
  }
}

export async function acquireRouterToken(baseURL: string): Promise<RouterTokens> {
  const env = envFor('router');
  if (!env['ROUTER_WALLET_PRIVATE_KEY']) {
    throw new Error('ROUTER_WALLET_PRIVATE_KEY is required to acquire a router JWT');
  }
  return loginWithWallet(baseURL, env['ROUTER_WALLET_PRIVATE_KEY']!);
}

/**
 * Acquire a JWT for the admin/root wallet (`ROUTER_ADMIN_PRIVATE_KEY`).
 *
 * The wallet whose address is listed in the router deployment's
 * `bootstrap.root_wallet_address` logs in as `RoleRootUser` (100), which
 * satisfies both `AdminAuth` (≥10) and `RootAuth` (100). Admin-only channel /
 * provider endpoints under `/api/v1/admin/*` require this token — the ordinary
 * `ROUTER_WALLET_PRIVATE_KEY` account is a `RoleCommonUser` and is rejected
 * with `{success:false, message:"无权进行此操作，权限不足"}`.
 */
export async function acquireAdminToken(baseURL: string): Promise<RouterTokens> {
  const env = envFor('router');
  if (!env['ROUTER_ADMIN_PRIVATE_KEY']) {
    throw new Error('ROUTER_ADMIN_PRIVATE_KEY is required to acquire a router admin JWT');
  }
  return loginWithWallet(baseURL, env['ROUTER_ADMIN_PRIVATE_KEY']!);
}