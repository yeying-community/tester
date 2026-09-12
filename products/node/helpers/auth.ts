/**
 * Node (control-plane) auth helpers.
 *
 * Node issues JWTs via the standard SIWE flow:
 *   POST /api/v1/public/auth/challenge  →  EIP-4361 challenge + nonce
 *   POST /api/v1/public/auth/verify     →  { token, address, expiresAt }
 *
 * Unlike warehouse, node does NOT require EIP-55 checksums — lowercase
 * addresses work fine. The refresh token is delivered as an HttpOnly
 * cookie; we don't need to handle it directly in tests.
 */
import { request } from '@playwright/test';
import { Wallet, getAddress } from 'ethers';
import { envFor } from '../../../shared/env';

export interface NodeTokens {
  token: string;
  address: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

export async function loginWithWallet(
  baseURL: string,
  privateKey: string,
): Promise<NodeTokens> {
  const wallet = new Wallet(privateKey);
  const address = getAddress(wallet.address);

  const ctx = await request.newContext({ baseURL });
  try {
    const cRes = await ctx.post('/api/v1/public/auth/challenge', {
      data: { address, chainId: 1 },
    });
    if (cRes.status() !== 200) {
      throw new Error(`challenge failed: ${cRes.status()} ${await cRes.text()}`);
    }
    const cBody = (await cRes.json()) as { data: { challenge: string; nonce: string } };
    const signature = await wallet.signMessage(cBody.data.challenge);

    const vRes = await ctx.post('/api/v1/public/auth/verify', {
      data: { address, nonce: cBody.data.nonce, signature },
    });
    if (vRes.status() !== 200) {
      throw new Error(`verify failed: ${vRes.status()} ${await vRes.text()}`);
    }
    const vBody = (await vRes.json()) as {
      data: { token: string; address: string; expiresAt: number; refreshExpiresAt: number };
    };
    return vBody.data;
  } finally {
    await ctx.dispose();
  }
}

export async function acquireNodeToken(baseURL: string): Promise<NodeTokens> {
  const env = envFor('node');
  if (!env['NODE_WALLET_PRIVATE_KEY']) {
    throw new Error('NODE_WALLET_PRIVATE_KEY is required to acquire a node JWT');
  }
  return loginWithWallet(baseURL, env['NODE_WALLET_PRIVATE_KEY']!);
}

export async function authedRequest(baseURL: string, token: string) {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}