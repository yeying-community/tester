/**
 * Bitcoin (Esplora REST) stubbing for hermetic wallet tests.
 *
 * The wallet's Bitcoin adapter talks to an Esplora backend
 * (`js/chain/adapters/bip122/rpc.js`) over RESTful paths, NOT JSON-RPC:
 *
 *   GET  /address/{addr}/utxo   → UTXO 列表 [{ txid, vout, value, status }]
 *   GET  /address/{addr}        → { chain_stats, mempool_stats }（余额）
 *   GET  /fee-estimates         → { "1": sat/vB, "3": ..., "6": ... }
 *   POST /tx  (body = hex)      → txid（纯文本 hex）
 *
 * The built-in `bitcoinMainnet` / `bitcoinTestnet` networks both point at
 * `https://blockstream.info(/testnet)/api`, so specs route that origin here.
 *
 * Address conventions: v1 发送方固定 P2WPKH（bc1q… / tb1q…），私钥字节复用
 * secp256k1 sk（同 Hardhat account #0）。收件人可为任意标准地址类型。
 */
import type { BrowserContext } from '@playwright/test';

/** Default Esplora base URLs used by `js/chain/adapters/bip122/rpc.js`. */
export const BITCOIN_MAINNET_RPC_URL = 'https://blockstream.info/api';
export const BITCOIN_TESTNET_RPC_URL = 'https://blockstream.info/testnet/api';

export interface BitcoinUtxo {
  txid: string;
  vout: number;
  value: number; // satoshi
  status?: { confirmed: boolean; block_height?: number };
}

export interface BitcoinRpcCapture {
  /** Every request, normalised: `{ method, path }`. */
  calls: Array<{ method: string; path: string }>;
  /** Each POST /tx records the raw tx hex body that was broadcast. */
  sentTxs: string[];
  /** The txid returned for each broadcast. */
  txids: string[];
}

export interface BitcoinRpcStubOptions {
  /** UTXOs returned for `GET /address/{addr}/utxo`. Defaults to a single 1 BTC UTXO. */
  utxos?: BitcoinUtxo[];
  /** sat/vB map returned for `GET /fee-estimates`. Defaults to { '1': 20, '3': 12, '6': 8 }. */
  feeEstimates?: Record<string, number>;
  /** funded/spent sums for `GET /address/{addr}` (satoshi). */
  fundedTxoSum?: number;
  spentTxoSum?: number;
  /** If set, POST /tx returns this txid instead of the deterministic sha256. */
  txidFactory?: (rawHex: string) => string;
  /** Shared capture sink; a fresh one is created when omitted. */
  captured?: BitcoinRpcCapture;
}

const DEFAULT_UTXOS: BitcoinUtxo[] = [
  {
    // Deterministic 64-hex txid; the adapter only reverses/serialises it.
    txid: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    vout: 0,
    value: 100_000_000, // 1 BTC — comfortably covers 0.001 BTC + fee
    status: { confirmed: true, block_height: 800_000 },
  },
];

const DEFAULT_FEE_ESTIMATES: Record<string, number> = { '1': 20, '3': 12, '6': 8 };

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Route every Esplora request under `urlPattern` (typically
 * `BITCOIN_MAINNET_RPC_URL + '/**'`) to an in-process responder,
 * discriminating by HTTP method + path. Returns the capture sink.
 */
export async function routeBitcoinNode(
  context: BrowserContext,
  urlPattern: string,
  options: BitcoinRpcStubOptions = {},
): Promise<BitcoinRpcCapture> {
  const captured: BitcoinRpcCapture = options.captured ?? {
    calls: [],
    sentTxs: [],
    txids: [],
  };
  const utxos = options.utxos ?? DEFAULT_UTXOS;
  const feeEstimates = options.feeEstimates ?? DEFAULT_FEE_ESTIMATES;

  await context.route(urlPattern, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const path = new URL(request.url()).pathname;
    captured.calls.push({ method, path });

    // POST /tx (or /.../api/tx) — broadcast raw tx hex, return txid text.
    if (method === 'POST' && /\/tx$/.test(path)) {
      const rawHex = (request.postData() ?? '').trim();
      captured.sentTxs.push(rawHex);
      const txid = options.txidFactory ? options.txidFactory(rawHex) : await sha256Hex(rawHex);
      captured.txids.push(txid);
      await route.fulfill({ status: 200, contentType: 'text/plain', body: txid });
      return;
    }

    // GET /address/{addr}/utxo
    if (method === 'GET' && /\/address\/[^/]+\/utxo$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(utxos),
      });
      return;
    }

    // GET /fee-estimates
    if (method === 'GET' && /\/fee-estimates$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(feeEstimates),
      });
      return;
    }

    // GET /address/{addr} — balance stats.
    if (method === 'GET' && /\/address\/[^/]+$/.test(path)) {
      const funded = options.fundedTxoSum ?? utxos.reduce((s, u) => s + u.value, 0);
      const spent = options.spentTxoSum ?? 0;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: path.split('/').pop(),
          chain_stats: { funded_txo_sum: funded, spent_txo_sum: spent, tx_count: 1 },
          mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
        }),
      });
      return;
    }

    // Unknown path — empty 200 so stray fetches during setup don't crash.
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  return captured;
}
