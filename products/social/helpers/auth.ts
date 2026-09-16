/**
 * Social auth helpers.
 *
 * Two real login paths, both verified against the live services:
 *
 *  1. email + password (platform 8888)
 *       POST /register {email, password, nickName}   -> {code:200, data:null}
 *       POST /login    {email, password, terminal}   -> LoginVO in `data`
 *
 *  2. wallet SIWE (web3-identity 8901)
 *       POST /auth/siwe/nonce  {address, chainId}    -> {nonce, expiresIn, chainId}
 *       POST /auth/siwe/verify {address, signature, message, terminal} -> LoginVO
 *     autoRegister=true, so any fresh wallet is auto-provisioned on first
 *     verify. The message is a standard EIP-4361 SIWE string; the server only
 *     parses the domain line, the address line, and the `Nonce:` / `Chain ID:`
 *     fields, then checks the personal_sign signature (EIP-191).
 *
 * Contract notes (live-verified):
 *  - Protected platform endpoints authenticate via a custom header
 *    `accessToken: <jwt>` (NOT `Authorization: Bearer`).
 *  - SIWE-issued and password-issued JWTs are interchangeable on the platform
 *    (shared JWT secret + user table), so a wallet login can drive the whole
 *    friend/group/message API.
 *  - The active web3-identity profile is `dev`, whose expected SIWE domain is
 *    `localhost:8080`. A mismatched domain yields {code:500,"SIWE域名校验失败"}.
 *
 * Env:
 *  - SOCIAL_BASE_URL      platform backend (8888)
 *  - SOCIAL_IDENTITY_URL  web3-identity SIWE service (8901)
 */
import { request, type APIRequestContext } from '@playwright/test';
import { Wallet } from 'ethers';

/** Expected SIWE domain for the live `dev` web3-identity profile. */
export const SIWE_DOMAIN = 'localhost:8080';

export interface LoginVO {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

/** A fresh, fully-provisioned social user reachable through the platform API. */
export interface SocialIdentity {
  address: string;
  privateKey: string;
  userId: number;
  login: LoginVO;
}

/** Build a standard EIP-4361 SIWE message the web3-identity parser accepts. */
export function buildSiweMessage(opts: {
  domain?: string;
  address: string;
  nonce: string;
  chainId: string;
  uri?: string;
  issuedAt?: string;
}): string {
  const domain = opts.domain ?? SIWE_DOMAIN;
  const uri = opts.uri ?? 'http://localhost:8082';
  const issuedAt = opts.issuedAt ?? new Date().toISOString();
  return (
    `${domain} wants you to sign in with your Ethereum account:\n` +
    `${opts.address}\n\n` +
    `Sign in to Yeying Social.\n\n` +
    `URI: ${uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${opts.chainId}\n` +
    `Nonce: ${opts.nonce}\n` +
    `Issued At: ${issuedAt}`
  );
}

/** POST /auth/siwe/nonce and return the raw envelope. */
export async function issueNonce(
  idCtx: APIRequestContext,
  address: string,
  chainId = '1',
): Promise<Envelope<{ nonce: string; expiresIn: number; chainId: string }>> {
  const res = await idCtx.post('/auth/siwe/nonce', { data: { address, chainId } });
  return (await res.json()) as Envelope<{ nonce: string; expiresIn: number; chainId: string }>;
}

/**
 * Full SIWE login: nonce -> personal_sign -> verify. Returns the LoginVO
 * envelope plus the wallet address. Node-side ethers signs, so the private
 * key never leaves the test runner.
 */
export async function siweLogin(
  identityURL: string,
  privateKey: string,
  chainId = '1',
): Promise<{ address: string; envelope: Envelope<LoginVO> }> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address; // EIP-55 checksum; server lower-cases internally
  const idCtx = await request.newContext({ baseURL: identityURL });
  try {
    const nonceEnv = await issueNonce(idCtx, address, chainId);
    const nonce = nonceEnv.data.nonce;
    const message = buildSiweMessage({ address, nonce, chainId: nonceEnv.data.chainId });
    const signature = await wallet.signMessage(message);
    const res = await idCtx.post('/auth/siwe/verify', {
      data: { address, signature, message, terminal: 0 },
    });
    return { address, envelope: (await res.json()) as Envelope<LoginVO> };
  } finally {
    await idCtx.dispose();
  }
}

/** Platform API context that carries the custom `accessToken` auth header. */
export async function platformCtx(baseURL: string, accessToken?: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: accessToken ? { accessToken } : {},
  });
}

/**
 * Create a brand-new wallet, log it in via SIWE, and resolve its platform
 * userId (GET /user/self). Returns everything needed to drive friend/group/
 * message flows as this user.
 */
export async function newSiweIdentity(
  platformURL: string,
  identityURL: string,
  attempts = 4,
): Promise<SocialIdentity> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const wallet = Wallet.createRandom();
      const { address, envelope } = await siweLogin(identityURL, wallet.privateKey);
      if (envelope.code !== 200 || !envelope.data?.accessToken) {
        throw new Error(`SIWE login failed: ${JSON.stringify(envelope)}`);
      }
      const ctx = await platformCtx(platformURL, envelope.data.accessToken);
      try {
        const selfRes = await ctx.get('/user/self');
        const self = (await selfRes.json()) as Envelope<{ id: number }>;
        if (self.code !== 200) {
          throw new Error(`/user/self failed: ${JSON.stringify(self)}`);
        }
        return {
          address,
          privateKey: wallet.privateKey,
          userId: self.data.id,
          login: envelope.data,
        };
      } finally {
        await ctx.dispose();
      }
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Bind two provisioned identities as mutual friends over the platform API.
 *
 * `/friend/add?friendId=` is one-directional, so both sides must add each
 * other before the messaging endpoints pass their `isFriend` gate (this mirrors
 * what social-flow.spec.ts does inline). Returns once both binds are code:200.
 */
export async function befriend(
  platformURL: string,
  a: SocialIdentity,
  b: SocialIdentity,
): Promise<void> {
  const ctxA = await platformCtx(platformURL, a.login.accessToken);
  const ctxB = await platformCtx(platformURL, b.login.accessToken);
  try {
    const addAB = await ctxA.post(`/friend/add?friendId=${b.userId}`);
    const addBA = await ctxB.post(`/friend/add?friendId=${a.userId}`);
    const okAB = ((await addAB.json()) as Envelope<null>).code;
    const okBA = ((await addBA.json()) as Envelope<null>).code;
    if (okAB !== 200 || okBA !== 200) {
      throw new Error(`befriend failed: ${okAB}/${okBA}`);
    }
  } finally {
    await ctxA.dispose();
    await ctxB.dispose();
  }
}

export interface EmailCreds {
  email: string;
  password: string;
  nickName: string;
}

/** Generate throwaway, unique registration credentials. */
export function randomEmailCreds(): EmailCreds {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `e2e_${stamp}@test.com`,
    password: 'Passw0rd!e2e',
    nickName: `E2E${stamp.slice(-6)}`,
  };
}

/**
 * POST /register then POST /login; returns the LoginVO envelope + creds.
 *
 * The platform's `/register` endpoint is not concurrency-safe (parallel
 * registrations can transiently return {code:500,"用户不存在"}). To keep the
 * suite deterministic under Playwright's parallel workers, this retries with
 * fresh credentials until a clean register+login succeeds (bounded).
 */
export async function registerAndLogin(
  platformURL: string,
  creds: EmailCreds = randomEmailCreds(),
  attempts = 5,
): Promise<{ creds: EmailCreds; register: Envelope<null>; login: Envelope<LoginVO> }> {
  const ctx = await request.newContext({ baseURL: platformURL });
  try {
    let last: { creds: EmailCreds; register: Envelope<null>; login: Envelope<LoginVO> } | null = null;
    for (let i = 0; i < attempts; i++) {
      const attemptCreds = i === 0 ? creds : randomEmailCreds();
      const regRes = await ctx.post('/register', {
        data: {
          email: attemptCreds.email,
          password: attemptCreds.password,
          nickName: attemptCreds.nickName,
        },
      });
      const register = (await regRes.json()) as Envelope<null>;
      const logRes = await ctx.post('/login', {
        data: { email: attemptCreds.email, password: attemptCreds.password, terminal: 0 },
      });
      const login = (await logRes.json()) as Envelope<LoginVO>;
      last = { creds: attemptCreds, register, login };
      if (register.code === 200 && login.code === 200) return last;
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
    return last!;
  } finally {
    await ctx.dispose();
  }
}
