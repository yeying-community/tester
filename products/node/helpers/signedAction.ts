/**
 * Node-side signed-action envelope builder for write flows.
 *
 * Every node write (create/update/publish/unpublish/delete an application,
 * upsert its config, submit an audit, …) is gated by `executeSignedAction`
 * (node `src/auth/actionSignature.ts`): the request body must carry a
 * `personal_sign` envelope `{ requestId, timestamp, signature }` over a
 * deterministic message:
 *
 *   YeYing Market
 *   Action: <action lowercased>
 *   Actor: <actor address lowercased>
 *   Timestamp: <timestamp>
 *   RequestId: <requestId>
 *   PayloadHash: <sha256(stableStringify(payload))>
 *
 * The server recomputes the payload from the request body and verifies the
 * signature with plain `ethers.verifyMessage` (EIP-191). So the client-side
 * `payload` here MUST mirror exactly what the route reconstructs — the
 * builders below encode that contract for the applications routes.
 *
 * `stableStringify` / message format are ported verbatim from the server so
 * the hashes line up byte-for-byte.
 */
import { createHash, randomUUID } from 'crypto';
import type { BaseWallet } from 'ethers';

export interface SignedActionEnvelope {
  requestId: string;
  timestamp: string;
  signature: string;
}

function normalizeType(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeAddress(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function buildMessage(input: {
  action: string;
  actor: string;
  timestamp: string;
  requestId: string;
  payload?: unknown;
}): string {
  return [
    'YeYing Market',
    `Action: ${normalizeType(input.action)}`,
    `Actor: ${normalizeAddress(input.actor)}`,
    `Timestamp: ${input.timestamp}`,
    `RequestId: ${input.requestId}`,
    `PayloadHash: ${payloadHash(input.payload ?? null)}`,
  ].join('\n');
}

/**
 * Build a valid signed-action envelope for `action` over `payload`, signed by
 * `wallet`. Each call mints a fresh `requestId` so the server's replay guard
 * (one requestId = one execution) never rejects a follow-up.
 */
export async function signAction(
  wallet: BaseWallet,
  input: { action: string; actor: string; payload?: unknown },
): Promise<SignedActionEnvelope> {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  const signature = await wallet.signMessage(
    buildMessage({ ...input, requestId, timestamp }),
  );
  return { requestId, timestamp, signature };
}

export interface CreateAppOverrides {
  did?: string;
  version?: number;
  name?: string;
  description?: string;
  location?: string;
  code?: string;
  /**
   * Relying-party redirect URIs (e.g. for the PKCE authorization flow). The
   * server stores the array verbatim on create, so the signed payload and the
   * request body carry the identical list.
   */
  redirectUris?: string[];
}

export interface CreateAppRequest {
  body: Record<string, unknown>;
  did: string;
  version: number;
  name: string;
}

/**
 * Build the request body (payload fields + signature envelope) for a signed
 * `POST /api/v1/public/applications`. `address` is the checksummed owner/actor
 * (owner-mismatch is normalized case-insensitively; the payload hash uses the
 * exact `owner` string we send here, which the server echoes back verbatim).
 *
 * A real `location` URL is required — the server derives a UCAN policy from it
 * and rejects an empty access address with HTTP 400.
 */
export async function buildCreateApplicationBody(
  wallet: BaseWallet,
  address: string,
  overrides: CreateAppOverrides = {},
): Promise<CreateAppRequest> {
  const ts = Date.now();
  const did = overrides.did ?? `did:e2e:${ts}-${Math.floor(Math.random() * 1e6)}`;
  const version = overrides.version ?? 1;
  const name = overrides.name ?? `e2e-app-${ts}`;
  const description = overrides.description ?? 'e2e signed-action draft';
  const location = overrides.location ?? 'http://localhost:3020';
  const code = overrides.code ?? 'APPLICATION_CODE_UNKNOWN';
  const redirectUris = overrides.redirectUris ?? [];

  // Mirror the server's reconstructed `signablePayload` exactly.
  const payload = {
    requestedUid: '',
    owner: address,
    ownerName: address,
    network: '',
    address: '',
    did,
    version,
    name,
    description,
    code,
    location,
    serviceCodes: '',
    redirectUris: redirectUris as string[],
    avatar: '',
    codePackagePath: '',
  };

  const env = await signAction(wallet, { action: 'application_create', actor: address, payload });
  return {
    body: { owner: address, did, version, name, description, location, code, redirectUris, ...env },
    did,
    version,
    name,
  };
}

export interface UpdateAppChanges {
  name?: string;
  description?: string;
  location?: string;
  code?: string;
  serviceCodes?: string | string[];
  redirectUris?: string | string[];
  avatar?: string;
  codePackagePath?: string;
}

/**
 * Build the request body + signed envelope for a signed
 * `PATCH /api/v1/public/applications/:uid` (`application_update`).
 *
 * The node route reconstructs the signable payload as `{ applicationUid, ...fields }`
 * where every field that is absent from the body is `undefined` (and therefore
 * dropped by `stableStringify`). So the payload we sign here includes ONLY the
 * keys present in `changes`, mirroring the server byte-for-byte.
 */
export async function buildUpdateApplicationBody(
  wallet: BaseWallet,
  address: string,
  uid: string,
  changes: UpdateAppChanges,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  const payload: Record<string, unknown> = { applicationUid: uid };

  for (const key of ['name', 'description', 'location', 'code', 'avatar', 'codePackagePath'] as const) {
    if (changes[key] !== undefined) {
      body[key] = changes[key];
      payload[key] = String(changes[key]);
    }
  }
  if (changes.serviceCodes !== undefined) {
    const serviceCodes = Array.isArray(changes.serviceCodes)
      ? changes.serviceCodes.map((item) => String(item)).join(',')
      : String(changes.serviceCodes);
    body.serviceCodes = changes.serviceCodes;
    payload.serviceCodes = serviceCodes;
  }
  if (changes.redirectUris !== undefined) {
    const list = (Array.isArray(changes.redirectUris) ? changes.redirectUris : [changes.redirectUris])
      .map((item) => String(item).trim())
      .filter(Boolean);
    const storage = list.length ? list[0] : '';
    body.redirectUris = changes.redirectUris;
    payload.redirectUris = storage ? [storage] : [];
  }

  const env = await signAction(wallet, { action: 'application_update', actor: address, payload });
  return { ...body, ...env };
}

/** Envelope for `POST /applications/:uid/publish` (payload = { applicationUid }). */
export function publishBody(wallet: BaseWallet, address: string, uid: string) {
  return signAction(wallet, {
    action: 'application_publish',
    actor: address,
    payload: { applicationUid: uid },
  });
}

/** Envelope for `POST /applications/:uid/unpublish`. */
export function unpublishBody(wallet: BaseWallet, address: string, uid: string) {
  return signAction(wallet, {
    action: 'application_unpublish',
    actor: address,
    payload: { applicationUid: uid },
  });
}

/** Envelope for `DELETE /applications/:uid`. */
export function deleteBody(wallet: BaseWallet, address: string, uid: string) {
  return signAction(wallet, {
    action: 'application_delete',
    actor: address,
    payload: { applicationUid: uid },
  });
}

export interface ConfigItem {
  code: string;
  instance: string;
}

/** Body for `PUT /applications/:uid/config` (config items + signed envelope). */
export async function buildConfigUpsertBody(
  wallet: BaseWallet,
  address: string,
  uid: string,
  config: ConfigItem[],
): Promise<Record<string, unknown>> {
  const env = await signAction(wallet, {
    action: 'application_config_upsert',
    actor: address,
    payload: { applicationUid: uid, applicant: address.toLowerCase(), config },
  });
  return { config, ...env };
}
