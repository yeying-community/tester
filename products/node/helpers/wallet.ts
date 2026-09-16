/**
 * Browser-side wallet shim for node write flows.
 *
 * node's application create/delete actions each require one or more
 * `personal_sign` calls (identity derivation + the signed action envelope),
 * driven through `@yeying-community/web3-bs` `signWithWallet`. That helper
 * resolves a provider via `getProvider({ preferYeYing: true })`, so the shim
 * advertises `isYeYing = true` to be selected immediately (skipping the
 * EIP-6963 discovery timeout) and also aliases `window.yeying`.
 *
 * The private key never enters the page: `personal_sign` is proxied to a
 * Node-side ethers `Wallet` via `page.exposeFunction`. The server verifies
 * signatures with plain `ethers.verifyMessage` (EIP-191), so signing the
 * message string with `wallet.signMessage` recovers the right address.
 *
 * Methods implemented (all web3-bs needs for SIWE + signed actions):
 *   eth_requestAccounts / eth_accounts / eth_chainId / net_version /
 *   wallet_requestPermissions / personal_sign.
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
 * Inject the wallet shim into `page`, backed by `privateKey`. Returns the
 * EOA address. Call before the first navigation so the init scripts and the
 * exposed signer are present on every page load.
 */
export async function injectWallet(page: Page, privateKey: string): Promise<string> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address;
  await page.exposeFunction('__e2e_signPersonal', async (message: string) =>
    wallet.signMessage(message),
  );
  await page.addInitScript({
    content: `window.__E2E_WALLET_ADDRESS__ = ${JSON.stringify(address)};`,
  });
  await page.addInitScript({ content: SHIM_SOURCE });
  return address;
}
