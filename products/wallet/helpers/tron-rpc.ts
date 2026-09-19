/**
 * Tron RPC stubbing for hermetic wallet tests.
 *
 * Mirrors `helpers/rpc.ts` (EVM JSON-RPC), but adapted for TronGrid's
 * REST-style endpoints:
 *
 *   - `/wallet/getnowblock`              → latest block (ref_block source)
 *   - `/wallet/getaccount`               → account + balance
 *   - `/wallet/createtransaction`        → build unsigned raw tx
 *   - `/wallet/broadcasttransaction`     → broadcast signed tx (returns `{txid, result}`)
 *   - `/wallet/gettransactionbyid`       → tx receipt by id
 *
 * The Tron signing-service path (js/chain/signing-service.js →
 * signTronTransactionLocal) fetches `/wallet/createtransaction`, computes
 * `sha256(raw_data_hex)` for the digest, signs locally, and POSTs the
 * concatenated signed hex to `/wallet/broadcasttransaction`. We capture
 * both the unsigned build request (so a spec can assert on amount,
 * to/from, fee_limit) and the broadcast payload (so a spec can assert
 * that signing produced a 65-byte ECDSA suffix — 64-byte r||s plus a
 * 1-byte v in {0,1} as Tron requires).
 *
 * Address conventions:
 *   - mainnet prefix byte: 0x41
 *   - shasta  prefix byte: 0xa0
 *   - nile    prefix byte: 0xa0
 *
 * For hermetic tests we use the well-known Hardhat/Anvil secp256k1
 * account #0:
 *
 *   priv: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *   mainnet addr: TYBNgWfhGuNzdLtjKtxXTfskAhTbMcqbaG
 *   shasta  addr: 27mHgDpz4j3QEKX8xekboXajUxcwCwKBMm1
 *
 * Both are derived via privateKeyToTronAddress(priv, 0x41|0xa0) — see
 * `wallet/js/chain/adapters/tron/address.js`. We assert on the truncated
 * prefix + suffix in e2e (full match would tie the spec to an exact
 * Base58 encoding that could change if the address helper is rewritten).
 */
import type { BrowserContext } from '@playwright/test';

/** The default Tron mainnet endpoint used by `js/chain/adapters/tron/rpc.js`. */
export const TRON_MAINNET_RPC_URL = 'https://api.trongrid.io';
export const TRON_SHASTA_RPC_URL = 'https://api.shasta.trongrid.io';
export const TRON_NILE_RPC_URL = 'https://api.nile.trongrid.io';

export interface TronRpcCapture {
  /**
   * Raw request bodies posted to the TronGrid endpoint, normalised:
   *   `{ path: string; payload: Record<string, unknown> }[]`.
   */
  calls: Array<{ path: string; payload: Record<string, unknown> }>;
  /**
   * Each broadcast receives a payload shaped like:
   *   `{ raw_data_hex: string; signature: string[] }`
   * We capture the raw_data_hex here and the signature (single hex
   * string in v1) under `signatures`.
   */
  rawDataHex: string[];
  signatures: string[];
  /**
   * Each successful broadcast gets a deterministic txid back — currently
   * `sha256(raw_data_hex)` so specs can cross-check it later via
   * `/wallet/gettransactionbyid`.
   */
  broadcastTxids: string[];
}

export interface TronRpcStubOptions {
  /** What balance `getaccount` reports for the from-address. SUN units (1 TRX = 1e6 SUN). Default '0'. */
  balanceSun?: string;
  /** Hex string used as the `txID` returned by broadcasttransaction. Default: deterministic sha256 of the raw data. */
  txidFactory?: (rawDataHex: string) => string;
  /** If set, `createtransaction` returns this error message instead of building a tx. */
  createTxError?: string;
  /** Shared capture sink; a fresh one is created when omitted. */
  captured?: TronRpcCapture;
}

const DEFAULT_REF_BLOCK = {
  blockID: '0000000000000000000000000000000000000000000000000000000000000001',
  block_header: {
    raw_data: {
      number: '0x10',
      txTrieRoot: '0000000000000000000000000000000000000000000000000000000000000000',
      witness_address: '0000000000000000000000000000000000000000',
      parentHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    witness_signature: '00'.repeat(65),
  },
};

async function sha256Hex(input: string): Promise<string> {
  // Use Node's webcrypto since the e2e harness is a Node script.
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Route every request matching `urlPattern` to an in-process TronGrid
 * responder. Returns the capture sink for later assertions.
 *
 * The route handler distinguishes request shape, not path, because the
 * wallet's RPC client always POSTs to `/wallet/<endpoint>` — there's no
 * GET-vs-POST split. The discriminator is `payload.visible ?: payload.transaction
 * ?: payload.value ?: payload.address`.
 */
export async function routeTronNode(
  context: BrowserContext,
  urlPattern: string,
  options: TronRpcStubOptions = {},
): Promise<TronRpcCapture> {
  const captured: TronRpcCapture = options.captured ?? {
    calls: [],
    rawDataHex: [],
    signatures: [],
    broadcastTxids: [],
  };

  await context.route(urlPattern, async (route) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
    } catch {
      payload = {};
    }
    // `route.request().url()` keeps the path after the host.
    const reqUrl = route.request().url();
    const path = (() => {
      try {
        return new URL(reqUrl).pathname;
      } catch {
        return reqUrl;
      }
    })();
    captured.calls.push({ path, payload });

    let body: unknown;
    if (path.endsWith('/wallet/getnowblock')) {
      body = DEFAULT_REF_BLOCK;
    } else if (path.endsWith('/wallet/getaccount')) {
      const address = String(payload?.address ?? '');
      body = {
        address,
        balance: options.balanceSun ?? '0',
        // All other fields TronGrid returns are irrelevant for v1.
      };
    } else if (path.endsWith('/wallet/createtransaction')) {
      if (options.createTxError) {
        body = {
          Error: { code: 1, message: options.createTxError },
        };
      } else {
        // The wallet's `transaction.js` only consumes `raw_data_hex` +
        // `raw_data` + `txID`. We mirror the wire shape from a real
        // TronGrid response so the adapter doesn't choke on a field it
        // happens to read.
        body = {
          visible: true,
          txID: '00'.repeat(32),
          raw_data: {
            contract: [
              {
                parameter: {
                  value: payload,
                },
                type: 'TransferContract',
              },
            ],
            ref_block_bytes: '0000',
            ref_block_hash: '0000000000000000',
            expiration: 1_700_000_000_000,
            timestamp: 1_700_000_000_000,
          },
          raw_data_hex: '0a0200012202080000000000000000000000000000000000000000000000000000000000000000400a0000000000000000000000000000000000000000000000000000000000000000',
        };
        // spec 用 captured.rawDataHex[lastIndex] 作 unsigned 参考；这里把
        // createtransaction 的 raw_data_hex 也 push 进去。
        captured.rawDataHex.push(String(body.raw_data_hex));
      }
    } else if (path.endsWith('/wallet/broadcasttransaction')) {
      const rawDataHex = String(payload?.raw_data_hex ?? '');
      const signature = Array.isArray(payload?.signature)
        ? payload.signature.map(String)
        : payload?.signature
        ? [String(payload.signature)]
        : [];
      // spec 用 captured.rawDataHex[lastIndex] 作 unsigned 参考（来自
      // createtransaction response）；这里只 push signatures，不重复
      // push raw_data_hex，避免覆盖 createtransaction push 的 unsigned。
      for (const sig of signature) captured.signatures.push(sig);
      const txid = options.txidFactory
        ? options.txidFactory(rawDataHex)
        : await sha256Hex(rawDataHex);
      captured.broadcastTxids.push(txid);
      body = { result: true, txid };
    } else if (path.endsWith('/wallet/gettransactionbyid')) {
      // Allow the wallet to refresh the activity list.
      body = {
        txID: String(payload?.value ?? ''),
        blockNumber: 16,
        block_timestamp: 1_700_000_000_000,
        contractResult: [],
      };
    } else {
      // Unknown Tron endpoint — return an empty object so the wallet
      // doesn't crash on a stray fetch during setup.
      body = {};
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  return captured;
}