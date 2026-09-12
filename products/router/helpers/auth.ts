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
      data: {
        token: string;
        user: { id: string };
        expires_at: string;
      };
    };
    if (!vBody.data) {
      throw new Error(`verify returned null data: ${vText}`);
    }
    return {
      token: vBody.data.token,
      userId: vBody.data.user.id,
      address,
      expiresAt: Math.floor(new Date(vBody.data.expires_at).getTime() / 1000),
    };
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