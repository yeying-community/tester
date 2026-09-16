/**
 * Self-asserted wallet-identity helper for node identity flows (TOTP / PKCE
 * authorization). Ported from node `src/auth/identityAccountLink.ts` and
 * `src/auth/identityActionAuthorization.ts`.
 *
 * The node identity subsystem verifies an identity DID document (and any
 * verifiable presentation over it) purely for *internal consistency*: the
 * `did:yeying:wid_...` id is self-asserted (there is no key→DID derivation
 * check), and the document/presentation signature is an Ed25519 signature over
 * the canonicalized object, made by a controller key that the document itself
 * declares. So a test can mint a fresh Ed25519 controller, pick any conforming
 * DID, and produce documents/presentations/action-authorizations the server
 * accepts — exactly what a real wallet-identity client does.
 *
 * `canonicalizeIdentityValue` is copied verbatim from the server so signed
 * bytes line up. Ed25519 raw public keys are the trailing 32 bytes of the DER
 * SPKI (the server prepends the fixed SPKI prefix to rebuild the key).
 */
import * as crypto from 'node:crypto';

export function canonicalizeIdentityValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeIdentityValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeIdentityValue((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  throw new Error('Unsupported canonical value');
}

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

export interface SelfAssertedIdentity {
  did: string;
  controllerId: string;
  /** Ed25519 sign the canonicalized object → base64url signature. */
  sign(value: unknown): string;
  /** A signed identity DID document (id + controllers + proof). */
  buildDocument(): Record<string, unknown>;
  /** Build + sign a verifiable presentation over the identity document. */
  buildPresentation(input: { audience: string; nonce: string; scopes: string[] }): Record<string, unknown>;
}

export function makeSelfAssertedIdentity(): SelfAssertedIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const raw = spki.subarray(spki.length - 32);
  const did = 'did:yeying:wid_' + crypto.randomBytes(24).toString('base64url');
  const controllerId = 'key-1';
  const controller = {
    controllerId,
    publicKey: b64url(raw),
    status: 'active',
    purposes: ['manage', 'authentication'],
  };
  const sign = (value: unknown) =>
    b64url(crypto.sign(null, Buffer.from(canonicalizeIdentityValue(value)), privateKey));

  const buildDocument = () => {
    const unsigned = { id: did, controllers: [controller], created: '2026-01-01T00:00:00.000Z' };
    return {
      ...unsigned,
      proof: {
        type: 'Ed25519Signature2020',
        verificationMethod: `${did}#${controllerId}`,
        proofValue: sign(unsigned),
      },
    };
  };

  const buildPresentation = (input: { audience: string; nonce: string; scopes: string[] }) => {
    const unsigned = {
      holder: did,
      audience: input.audience,
      nonce: input.nonce,
      identityDocument: buildDocument(),
      scopes: input.scopes,
    };
    return {
      ...unsigned,
      proof: {
        type: 'Ed25519Signature2020',
        verificationMethod: `${did}#${controllerId}`,
        proofValue: sign(unsigned),
      },
    };
  };

  return { did, controllerId, sign, buildDocument, buildPresentation };
}

// --- TOTP (RFC 6238, matches node identityTotpAuth: SHA1 / 6 digits / 30s) ---

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/=+$/, '')) {
    const idx = alphabet.indexOf(ch.toUpperCase());
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate the current TOTP code for a base32 secret. */
export function totpCode(secretBase32: string, atMs: number = Date.now()): string {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(atMs / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000) >>> 0, 0);
  buf.writeUInt32BE((counter % 0x100000000) >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 1_000_000).padStart(6, '0');
}
