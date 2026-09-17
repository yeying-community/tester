/**
 * Browser-side wallet shim for the chat (NextChat) UCAN/SIWE login.
 *
 * chat's login runs through `@yeying-community/web3-bs`:
 *   resolveWalletAccount() -> eth_requestAccounts
 *   createRootUcan()       -> personal_sign over the UCAN root statement
 * `getProvider({ preferYeYing: true })` selects a provider that advertises
 * `isYeYing = true`, so the shim sets that flag and also aliases
 * `window.yeying` to skip the EIP-6963 discovery timeout.
 *
 * The private key never enters the page: `personal_sign` /
 * `eth_signTypedData*` are proxied to a Node-side ethers `Wallet` via
 * `page.exposeFunction`. This mirrors products/node/helpers/wallet.ts.
 */
import type { Page } from '@playwright/test';
import { Wallet } from 'ethers';

const SHIM_SOURCE = `
(function () {
  if (window.ethereum && window.ethereum.__E2E_SHIM__) return;
  const ADDRESS = window.__E2E_WALLET_ADDRESS__;
  if (!ADDRESS) throw new Error('wallet address not injected');
  const listeners = {};
  const eth = {
    __E2E_SHIM__: true,
    isYeYing: true,
    isMetaMask: false,
    chainId: '0x1',
    selectedAddress: ADDRESS,
    networkVersion: '1',
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [ADDRESS];
        case 'eth_chainId':
          return eth.chainId;
        case 'net_version':
          return '1';
        case 'wallet_requestPermissions':
          return [{ parentCapability: 'eth_accounts', caveats: [], date: Date.now() }];
        case 'personal_sign': {
          const message = Array.isArray(params) ? params[0] : params;
          return await window.__e2e_signPersonal(String(message));
        }
        case 'eth_sign': {
          const message = Array.isArray(params) ? params[1] : params;
          return await window.__e2e_signPersonal(String(message));
        }
        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          const data = Array.isArray(params) ? params[1] : params;
          return await window.__e2e_signTypedData(String(data));
        }
        default:
          return null;
      }
    },
    on: (event, handler) => {
      (listeners[event] = listeners[event] || []).push(handler);
      return eth;
    },
    addListener: (event, handler) => eth.on(event, handler),
    removeListener: (event, handler) => {
      const arr = listeners[event] || [];
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    },
    enable: async () => [ADDRESS],
  };
  window.ethereum = eth;
  window.yeying = eth;
})();
`;

/**
 * Inject the wallet shim into `page`, backed by `privateKey`. Returns the EOA
 * address. Call before the first navigation so the init scripts and the exposed
 * signers are present on every page load.
 */
export async function injectWallet(page: Page, privateKey: string): Promise<string> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address;
  await page.exposeFunction('__e2e_signPersonal', async (message: string) =>
    wallet.signMessage(message),
  );
  await page.exposeFunction('__e2e_signTypedData', async (raw: string) => {
    // web3-bs uses personal_sign for the UCAN root; typed-data is only a
    // best-effort fallback. Parse EIP-712 payload and sign, ignoring the
    // EIP712Domain entry Metamask-style.
    try {
      const parsed = JSON.parse(raw);
      const types = { ...(parsed.types || {}) };
      delete types.EIP712Domain;
      return await wallet.signTypedData(parsed.domain ?? {}, types, parsed.message ?? {});
    } catch {
      return wallet.signMessage(raw);
    }
  });
  await page.addInitScript({
    content: `window.__E2E_WALLET_ADDRESS__ = ${JSON.stringify(address)};`,
  });
  await page.addInitScript({ content: SHIM_SOURCE });
  return address;
}
