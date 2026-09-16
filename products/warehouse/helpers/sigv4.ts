/**
 * Minimal AWS Signature V4 (header-based) signer for the warehouse S3 endpoint.
 *
 * The tester repo intentionally has no AWS SDK dependency, so we implement the
 * small slice of SigV4 the warehouse S3 server verifies (see
 * warehouse/internal/interface/s3/signature_v4.go):
 *   - header form only (no presigned query form)
 *   - signed headers: host;x-amz-content-sha256;x-amz-date (sorted, lowercased)
 *   - region us-east-1, service s3
 *   - payload hash = sha256(body) hex (empty body for GET ListBuckets)
 *
 * Node's built-in `crypto` provides HMAC-SHA256 / SHA-256; no extra deps.
 */
import { createHash, createHmac } from 'node:crypto';

export interface SigV4Options {
  method: string;
  /** Full endpoint, e.g. http://localhost:6066 */
  endpoint: string;
  /** Request path, e.g. "/" */
  path?: string;
  /** Raw query string without leading '?', already canonicalized by caller. */
  query?: string;
  accessKeyId: string;
  secret: string;
  region?: string;
  service?: string;
  /** Request body; empty string for GET ListBuckets. */
  body?: string;
  /** Override the signing time (mainly for tests). */
  now?: Date;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function amzDate(now: Date): { amz: string; date: string } {
  // 20060102T150405Z / 20060102
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  // iso is like 20060102T150405Z already after stripping separators/millis
  const amz = iso;
  const date = amz.slice(0, 8);
  return { amz, date };
}

/**
 * Produce the signed URL + headers for a header-based SigV4 request. The
 * returned headers must be sent verbatim (Host is included by the HTTP client
 * from the URL, and must match the signed host value).
 */
export function signSigV4(opts: SigV4Options): SignedRequest {
  const region = opts.region ?? 'us-east-1';
  const service = opts.service ?? 's3';
  const method = opts.method.toUpperCase();
  const path = opts.path ?? '/';
  const query = opts.query ?? '';
  const body = opts.body ?? '';
  const now = opts.now ?? new Date();

  const url = new URL(opts.endpoint);
  // host header must include the port when non-default (matches r.Host).
  const host = url.host;

  const { amz, date } = amzDate(now);
  const payloadHash = sha256Hex(body);

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amz}\n`;

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${opts.secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `${url.origin}${path}${query ? `?${query}` : ''}`,
    headers: {
      Authorization: authorization,
      'X-Amz-Date': amz,
      'X-Amz-Content-Sha256': payloadHash,
    },
  };
}
