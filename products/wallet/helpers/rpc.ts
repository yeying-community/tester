/**
 * A minimal JSON-RPC node stub for hermetic wallet tests.
 *
 * Several wallet flows (native send, ERC-20 transfer, token balance, dApp
 * `eth_sendTransaction`) drive the extension's background service worker to
 * talk to an EVM RPC endpoint. Playwright's `context.route` intercepts the
 * SW's `fetch`, so we can stand in for a real node.
 *
 * The tricky part is broadcasting: the wallet signs with ethers, then ethers
 * verifies that the hash returned by `eth_sendRawTransaction` equals the hash
 * it computed for the signed transaction. We satisfy that by computing the
 * real keccak256 of the raw signed tx and returning it — so a "successful"
 * broadcast never touches a live chain yet still yields a genuine tx hash.
 *
 * `captured` records every JSON-RPC call (and raw signed txs) so a spec can
 * assert on what the wallet actually sent (e.g. an ERC-20 `transfer` calldata).
 */
import { ethers } from 'ethers';
import type { BrowserContext } from '@playwright/test';

export interface RpcCapture {
  calls: Array<{ method: string; params: unknown[] }>;
  rawTxs: string[];
}

export interface RpcStubOptions {
  /** chainId returned by `eth_chainId`, hex string e.g. '0x539'. */
  chainId: string;
  /** hex wei returned by `eth_getBalance`. Default '0x0'. */
  balanceWei?: string;
  /** 32-byte hex returned by `eth_call` (ERC-20 balanceOf). Default 0. */
  tokenBalance?: string;
  /** If set, `eth_estimateGas` responds with this JSON-RPC error message. */
  estimateGasError?: string;
  /** Shared capture sink; a fresh one is created when omitted. */
  captured?: RpcCapture;
}

const ZERO32 = '0x' + '0'.repeat(64);

// A well-formed "latest" block. ethers v6 calls `getBlock('latest')` while
// populating fees and *formats* the result, so returning `null` throws
// (`Cannot read properties of null (reading 'hash')`). Providing a real
// block object with `baseFeePerGas` lets ethers compute EIP-1559 fees.
const STUB_BLOCK = {
  number: '0x10',
  hash: '0x' + '11'.repeat(32),
  parentHash: '0x' + '22'.repeat(32),
  nonce: '0x0000000000000000',
  sha3Uncles: '0x' + '0'.repeat(64),
  logsBloom: '0x' + '0'.repeat(512),
  transactionsRoot: '0x' + '0'.repeat(64),
  stateRoot: '0x' + '0'.repeat(64),
  receiptsRoot: '0x' + '0'.repeat(64),
  miner: '0x' + '0'.repeat(40),
  difficulty: '0x0',
  totalDifficulty: '0x0',
  extraData: '0x',
  size: '0x3e8',
  gasLimit: '0x1c9c380',
  gasUsed: '0x0',
  timestamp: '0x0',
  baseFeePerGas: '0x3b9aca00', // 1 gwei
  transactions: [] as string[],
  uncles: [] as string[],
};

/**
 * Route every request matching `urlPattern` to an in-process JSON-RPC
 * responder. Returns the capture sink for later assertions.
 */
export async function routeRpcNode(
  context: BrowserContext,
  urlPattern: string,
  options: RpcStubOptions,
): Promise<RpcCapture> {
  const captured: RpcCapture = options.captured ?? { calls: [], rawTxs: [] };

  await context.route(urlPattern, async (route) => {
    let body: unknown = null;
    try {
      body = route.request().postDataJSON();
    } catch {
      body = null;
    }

    const handleOne = (req: any) => {
      const id = req?.id ?? 1;
      const method: string = req?.method ?? '';
      const params: unknown[] = Array.isArray(req?.params) ? req.params : [];
      captured.calls.push({ method, params });

      const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
      const fail = (message: string, code = -32000) => ({
        jsonrpc: '2.0',
        id,
        error: { code, message },
      });

      switch (method) {
        case 'eth_chainId':
          return ok(options.chainId);
        case 'net_version':
          return ok(String(parseInt(options.chainId, 16)));
        case 'eth_blockNumber':
          return ok('0x10');
        case 'eth_getBalance':
          return ok(options.balanceWei ?? '0x0');
        case 'eth_getTransactionCount':
          return ok('0x0');
        case 'eth_gasPrice':
          return ok('0x3b9aca00'); // 1 gwei
        case 'eth_maxPriorityFeePerGas':
          return ok('0x3b9aca00');
        case 'eth_estimateGas':
          if (options.estimateGasError) return fail(options.estimateGasError);
          return ok('0x5208'); // 21000
        case 'eth_getBlockByNumber':
        case 'eth_getBlockByHash':
          // Return a well-formed block so ethers can format it.
          return ok(STUB_BLOCK);
        case 'eth_call':
          return ok(options.tokenBalance ?? ZERO32);
        case 'eth_getCode':
          return ok('0x');
        case 'eth_sendRawTransaction': {
          const raw = String(params[0] ?? '');
          captured.rawTxs.push(raw);
          try {
            return ok(ethers.keccak256(raw));
          } catch {
            return fail('invalid raw transaction');
          }
        }
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionReceipt':
          return ok(null);
        default:
          return ok(null);
      }
    };

    const response = Array.isArray(body) ? body.map(handleOne) : handleOne(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  return captured;
}
