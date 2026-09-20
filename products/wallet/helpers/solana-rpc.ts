/**
 * Solana JSON-RPC stubbing for hermetic wallet tests.
 *
 * Mirrors `helpers/tron-rpc.ts` (REST-style) but Solana uses JSON-RPC over
 * HTTPS (POST { jsonrpc, id, method, params } → { jsonrpc, id, result | error }).
 *
 * The wallet's `js/chain/adapters/solana/rpc.js#solanaRpcCall` posts to
 * the URLs registered for the three references:
 *   - solana:mainnet-beta → https://api.mainnet-beta.solana.com
 *   - solana:devnet       → https://api.devnet.solana.com
 *   - solana:testnet      → https://api.testnet.solana.com
 *
 * The signing-service path (`signSolanaTransactionLocal`) calls:
 *   - `getRecentBlockhash` (returns `{ value: { blockhash, feeCalculator } }`)
 *   - `sendTransaction` (params = [base58_wire_tx, { encoding: 'base58', ... }];
 *     returns the base58 transaction signature / txid)
 *
 * Address conventions: base58(32-byte ed25519 pubkey). v1 simplification:
 * the same secp256k1 hex private key used by Hardhat/Anvil account #0
 * doubles as the ed25519 seed for the Solana address (no SLIP-0010). The
 * resulting base58 address is captured here for spec assertions.
 */
import type { BrowserContext } from '@playwright/test';

/** The default Solana mainnet endpoint used by `js/chain/adapters/solana/rpc.js`. */
export const SOLANA_MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';
export const SOLANA_DEVNET_RPC_URL = 'https://api.devnet.solana.com';
export const SOLANA_TESTNET_RPC_URL = 'https://api.testnet.solana.com';

export interface SolanaRpcCapture {
  /** Raw JSON-RPC requests, normalised: `{ method, params }`. */
  calls: Array<{ method: string; params: unknown[] }>;
  /** Each `sendTransaction` call records the wire base58 transaction bytes. */
  sentTxs: string[];
  /** Each `getBalance` response records the configured balance (lamports). */
  balanceLamports: string[];
}

export interface SolanaRpcStubOptions {
  /** What balance `getBalance` reports for the queried address. Default '0'. */
  balanceLamports?: string;
  /**
   * Raw SPL token amount (base units) returned by `getTokenAccountsByOwner`
   * for any mint. When set, the responder returns a single parsed token
   * account whose `tokenAmount.amount` equals this string. Default: no
   * accounts (balance 0).
   */
  splTokenAmount?: string;
  /** Decimals reported in the parsed `tokenAmount`. Default 6 (USDC). */
  splTokenDecimals?: number;
  /** If set, `sendTransaction` returns this string as the txid instead of the deterministic sha256. */
  txidFactory?: (base58Wire: string) => string;
  /** If set, every JSON-RPC call returns this error message. */
  rpcError?: string;
  /** Shared capture sink; a fresh one is created when omitted. */
  captured?: SolanaRpcCapture;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Route every JSON-RPC POST matching `urlPattern` to an in-process Solana
 * responder. Returns the capture sink for later assertions.
 *
 * The route handler discriminates by the `method` field of the JSON body
 * (the wallet's RPC client is generic over `method`).
 */
export async function routeSolanaNode(
  context: BrowserContext,
  urlPattern: string,
  options: SolanaRpcStubOptions = {},
): Promise<SolanaRpcCapture> {
  const captured: SolanaRpcCapture = options.captured ?? {
    calls: [],
    sentTxs: [],
    balanceLamports: [],
  };

  await context.route(urlPattern, async (route) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
    } catch {
      payload = {};
    }
    const method = String(payload?.method ?? '');
    const params = Array.isArray(payload?.params) ? (payload.params as unknown[]) : [];
    captured.calls.push({ method, params });

    let body: unknown;
    if (options.rpcError) {
      body = { jsonrpc: '2.0', id: payload?.id, error: { code: -32000, message: options.rpcError } };
    } else if (method === 'getBalance') {
      const balance = options.balanceLamports ?? '0';
      captured.balanceLamports.push(balance);
      body = {
        jsonrpc: '2.0',
        id: payload?.id,
        result: {
          context: { slot: 1 },
          value: Number(balance),
        },
      };
    } else if (method === 'getRecentBlockhash') {
      // Solana `getRecentBlockhash` returns `{ value: { blockhash, feeCalculator: { lamportsPerSignature } } }`.
      body = {
        jsonrpc: '2.0',
        id: payload?.id,
        result: {
          context: { slot: 1 },
          value: {
            blockhash: 'GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MRBSKQ',
            feeCalculator: { lamportsPerSignature: 5000 },
          },
        },
      };
    } else if (method === 'sendTransaction') {
      // Params: [base58_wire_tx, { encoding, preflightCommitment, ... }].
      const wire = String(params[0] ?? '');
      captured.sentTxs.push(wire);
      const txid = options.txidFactory
        ? options.txidFactory(wire)
        : await sha256Hex(wire);
      body = { jsonrpc: '2.0', id: payload?.id, result: txid };
    } else if (method === 'getTokenAccountsByOwner') {
      // SPL balance path. Params: [owner, { mint }, { encoding: 'jsonParsed' }].
      // Return a single parsed token account carrying `splTokenAmount` base
      // units, or no accounts (balance 0) when unset.
      const amount = options.splTokenAmount;
      const decimals = options.splTokenDecimals ?? 6;
      const value = amount == null
        ? []
        : [
            {
              pubkey: 'AtaAtaAtaAtaAtaAtaAtaAtaAtaAtaAtaAtaAtaAtaA1',
              account: {
                data: {
                  parsed: {
                    info: {
                      tokenAmount: {
                        amount: String(amount),
                        decimals,
                        uiAmountString: (Number(amount) / 10 ** decimals).toString(),
                      },
                    },
                    type: 'account',
                  },
                  program: 'spl-token',
                },
              },
            },
          ];
      body = {
        jsonrpc: '2.0',
        id: payload?.id,
        result: { context: { slot: 1 }, value },
      };
    } else {
      // Unknown RPC method — return an empty result so the wallet doesn't
      // crash on a stray fetch during setup.
      body = { jsonrpc: '2.0', id: payload?.id, result: null };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  return captured;
}