/**
 * Router — real wallet-identity onboarding helper.
 *
 * Drives a genuine `did:yeying:wid_…` identity to the point where the Router
 * backend will accept a wallet-identity login. This exercises the *real*
 * services (no stubs): the YeYing Node identity issuer on `:8100` and the
 * Mailpit dev inbox on `:8025` that captures the verification-code email the
 * Node sends over SMTP `127.0.0.1:1025`.
 *
 * The onboarding sequence mirrors what the wallet's identity-settings
 * controller does interactively, but scripted end-to-end:
 *
 *   1. IDENTITY_CREATE            → a fresh Ed25519 wallet identity (the DID).
 *   2. account-links/challenge    → Node hands back a message to sign.
 *   3. SIGN_MESSAGE               → the EVM account signs it (proves ownership).
 *   4. account-links/verify       → Node issues the WalletAccountCredential.
 *   5. IDENTITY_VERIFICATION_REQUEST (email + username) → Node emails a code.
 *   6. read the 6-digit code from Mailpit.
 *   7. IDENTITY_VERIFICATION_CONFIRM → Node issues Email/Username credentials.
 *
 * After this the selected identity holds all three credential types Router
 * requires (WalletAccount + Email + Username), so a subsequent
 * `wallet_identity_presentation` produces a VP the Router verifier accepts.
 *
 * Node HTTP + Mailpit calls use the browser context's APIRequestContext;
 * wallet operations use the SW message bus (`sendSw`) against the popup page.
 */
import type { APIRequestContext, Page } from '@playwright/test';

import { sendSw } from '../../wallet/helpers/popup';

export function resolveNodeUrl(): string {
  return (process.env.NODE_BASE_URL?.trim() || 'http://localhost:8100').replace(/\/+$/, '');
}

export function resolveMailpitUrl(): string {
  return (process.env.MAILPIT_URL?.trim() || 'http://127.0.0.1:8025').replace(/\/+$/, '');
}

const IDENTITY_API = '/api/v1/public/identity';

interface NodeEnvelope<T = any> {
  code?: number;
  message?: string;
  data?: T;
}

async function nodePost<T = any>(
  request: APIRequestContext,
  nodeUrl: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await request.post(`${nodeUrl}${IDENTITY_API}${path}`, {
    data: body as any,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  const json = (await res.json().catch(() => ({}))) as NodeEnvelope<T>;
  if (!res.ok() || (typeof json.code === 'number' && json.code !== 0)) {
    throw new Error(
      `Node ${path} failed (HTTP ${res.status()}): ${json.message || JSON.stringify(json)}`,
    );
  }
  return (json.data ?? (json as unknown as T)) as T;
}

/**
 * Poll Mailpit for the newest identity verification-code email addressed to
 * `email`, and return the 6-digit code. The Node subject line is
 * `【夜莺社区】身份绑定验证码：NNNNNN` and the body repeats it.
 */
export async function readMailpitCode(
  request: APIRequestContext,
  mailpitUrl: string,
  email: string,
  opts: { sinceMs?: number; timeoutMs?: number } = {},
): Promise<string> {
  const sinceMs = opts.sinceMs ?? 0;
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  const query = encodeURIComponent(`to:${email}`);
  let lastSeen = 'none';
  while (Date.now() < deadline) {
    const res = await request.get(`${mailpitUrl}/api/v1/search?query=${query}&limit=5`);
    if (res.ok()) {
      const body = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ ID: string; Subject?: string; Created?: string }>;
      };
      const messages = (body.messages ?? []).filter(
        (m) => !sinceMs || Date.parse(m.Created ?? '') >= sinceMs - 1000,
      );
      // Newest first (Mailpit returns newest first already, but be explicit).
      messages.sort((a, b) => Date.parse(b.Created ?? '') - Date.parse(a.Created ?? ''));
      for (const m of messages) {
        const fromSubject = m.Subject?.match(/(\d{6})/)?.[1];
        if (fromSubject) return fromSubject;
        const full = await request.get(`${mailpitUrl}/api/v1/message/${m.ID}`);
        if (full.ok()) {
          const detail = (await full.json().catch(() => ({}))) as { Text?: string; Subject?: string };
          const code = (detail.Subject ?? '').match(/(\d{6})/)?.[1] ?? (detail.Text ?? '').match(/(\d{6})/)?.[1];
          if (code) return code;
        }
        lastSeen = m.Subject ?? m.ID;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verification-code email for ${email} in Mailpit (last seen: ${lastSeen})`);
}

export interface OnboardedIdentity {
  did: string;
  identityId: string;
  address: string;
  chainKey: string;
  email: string;
  username: string;
  credentialTypes: string[];
}

/**
 * Run the full real onboarding against Node + Mailpit and return the created
 * identity's coordinates. The wallet must already be created + unlocked; the
 * popup page is used to drive the SW bus.
 */
export async function onboardWalletIdentity(args: {
  popup: Page;
  request: APIRequestContext;
  password: string;
  nodeUrl?: string;
  mailpitUrl?: string;
}): Promise<OnboardedIdentity> {
  const { popup, request, password } = args;
  const nodeUrl = args.nodeUrl ?? resolveNodeUrl();
  const mailpitUrl = args.mailpitUrl ?? resolveMailpitUrl();

  // 1. Create + select a fresh wallet identity.
  const created = await sendSw<any>(popup, 'IDENTITY_CREATE', { password });
  const did: string = created?.document?.id;
  const identityId: string = created?.document?.walletIdentityId;
  if (!did || !identityId) throw new Error(`IDENTITY_CREATE returned no DID: ${JSON.stringify(created)}`);

  // Current account (the EVM account that will be linked to the identity).
  const acct = await sendSw<any>(popup, 'GET_CURRENT_ACCOUNT', {});
  const account = acct?.account ?? acct;
  const address: string = account?.address;
  if (!address) throw new Error(`GET_CURRENT_ACCOUNT returned no address: ${JSON.stringify(acct)}`);
  const chainKey: string = account?.chainKey || `eip155:${account?.chainId || 1}`;

  // 2. account-links/challenge → message to sign.
  const challenge = await nodePost<any>(request, nodeUrl, '/account-links/challenge', {
    identity: did,
    account: { chainKey, address },
  });
  if (!challenge?.message) throw new Error(`account-links/challenge returned no message: ${JSON.stringify(challenge)}`);

  // Sign the identity document (Node validates its proof) …
  const exported = await sendSw<any>(popup, 'IDENTITY_EXPORT_DOCUMENT', { identityId });
  const signedDocument = await sendSw<any>(popup, 'IDENTITY_SIGN_DOCUMENT', {
    identityId,
    document: exported?.document ?? exported,
    password,
  });
  // … and sign the challenge with the EVM account key.
  const signRes = await sendSw<any>(popup, 'SIGN_MESSAGE', { message: challenge.message, password });
  const accountSignature: string = signRes?.signature;
  if (!signRes?.success || !accountSignature) {
    throw new Error(`SIGN_MESSAGE failed: ${JSON.stringify(signRes)}`);
  }

  // 4. account-links/verify → WalletAccountCredential.
  const linkResult = await nodePost<any>(request, nodeUrl, '/account-links/verify', {
    identityDocument: signedDocument,
    identity: did,
    account: { chainKey, address },
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
    accountSignature,
  });
  const walletCredential = linkResult?.credential;
  if (!walletCredential) throw new Error(`account-links/verify returned no credential: ${JSON.stringify(linkResult)}`);
  await sendSw(popup, 'IDENTITY_SAVE_CREDENTIALS', { identityId, credentials: [walletCredential] });

  // 5-7. Email + username verification (Node → Mailpit → confirm).
  // base36 keeps the username short (~11 chars: `e2e` + timestamp) yet unique
  // per run and within Router's `^[a-z0-9][a-z0-9._-]{2,19}$` (3–20) rule.
  const stamp = Date.now();
  const slug = stamp.toString(36);
  const email = `router-id-${slug}@e2e.local`;
  const username = `e2e${slug}`;
  const requestedAt = Date.now();
  const verification = await sendSw<any>(popup, 'IDENTITY_VERIFICATION_REQUEST', {
    endpoint: nodeUrl,
    types: ['email', 'username'],
    identity: did,
    account: { chainKey, address },
    email,
    username,
  });
  const verificationId: string = verification?.verificationId;
  if (!verificationId) throw new Error(`verification request returned no id: ${JSON.stringify(verification)}`);

  const code = await readMailpitCode(request, mailpitUrl, email, { sinceMs: requestedAt });
  const confirm = await sendSw<any>(popup, 'IDENTITY_VERIFICATION_CONFIRM', {
    endpoint: nodeUrl,
    identityId,
    verificationId,
    code,
    types: ['email', 'username'],
  });
  if (!Array.isArray(confirm?.credentials) || confirm.credentials.length < 2) {
    throw new Error(`verification confirm did not issue credentials: ${JSON.stringify(confirm)}`);
  }

  // Sanity: the identity should now carry all three credential types.
  const listed = await sendSw<any>(popup, 'IDENTITY_LIST_CREDENTIALS', { identityId });
  const credentialTypes = new Set<string>();
  for (const item of listed?.credentials ?? []) {
    const token = item?.credential || item?.jwt || (typeof item === 'string' ? item : '');
    const parts = String(token).split('.');
    if (parts.length >= 2) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        for (const t of payload?.vc?.type ?? []) credentialTypes.add(t);
      } catch {
        /* ignore malformed */
      }
    }
  }

  return { did, identityId, address, chainKey, email, username, credentialTypes: [...credentialTypes] };
}

export interface RouterIdentitySession {
  sessionId: string;
  nonce: string;
  audience: string;
  scopes: string[];
  expiresAt: number;
}

/** Create a Router identity login session (avatar excluded to match the wallet). */
export async function routerCreateIdentitySession(
  request: APIRequestContext,
  routerBase: string,
): Promise<RouterIdentitySession> {
  const res = await request.post(
    `${routerBase}/api/v1/public/auth/identity/login/session?avatar=0`,
    { headers: { Accept: 'application/json' } },
  );
  const json = (await res.json().catch(() => ({}))) as NodeEnvelope<any>;
  if (!res.ok() || json.code !== 0 || !json.data?.session_id) {
    throw new Error(`identity login session failed (HTTP ${res.status()}): ${json.message || JSON.stringify(json)}`);
  }
  const d = json.data;
  return {
    sessionId: d.session_id,
    nonce: d.nonce,
    audience: d.audience,
    scopes: Array.isArray(d.scopes) ? d.scopes : String(d.scopes || '').split(/\s+/).filter(Boolean),
    expiresAt: d.expires_at,
  };
}

/** Submit a verifiable presentation to complete the Router identity login. */
export async function routerVerifyIdentityLogin(
  request: APIRequestContext,
  routerBase: string,
  args: { sessionId: string; address: string; presentation: unknown },
): Promise<{ ok: boolean; status: number; data?: any; message?: string }> {
  const res = await request.post(`${routerBase}/api/v1/public/auth/identity/login/verify`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    data: {
      session_id: args.sessionId,
      address: args.address,
      presentation: args.presentation,
    } as any,
  });
  const json = (await res.json().catch(() => ({}))) as NodeEnvelope<any>;
  return { ok: res.ok() && json.code === 0, status: res.status(), data: json.data, message: json.message };
}
