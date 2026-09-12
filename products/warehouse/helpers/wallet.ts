/**
 * Browser-side wallet shim. Injects an EIP-1193 compatible provider into
 * `window.ethereum` so the warehouse frontend's wallet flows can complete
 * in headless Chromium without a real MetaMask / 夜莺钱包.
 *
 * Two helpers:
 *   - injectWallet(page, privateKey)         — full EIP-1193 provider, for
 *                                              the live "钱包登录" button
 *                                              (requires the SDK to be able
 *                                              to call personal_sign on its
 *                                              own — sufficient for any test
 *                                              that exercises the wallet
 *                                              button end-to-end).
 *   - exposeWalletSigner(page, wallet)       — exposes __e2e_signPersonal
 *                                              so a test can run its own
 *                                              SIWE flow from inside the
 *                                              browser (used to seed a
 *                                              logged-in UI state via the
 *                                              classical challenge/verify
 *                                              endpoint, which is more
 *                                              stable to mock than the
 *                                              UCAN identity flow the
 *                                              wallet button itself uses).
 *
 * Both helpers rely on Playwright's `page.exposeFunction`, which keeps
 * ethers / the private key in the Node-side test runner — nothing crypto
 * ever enters the page context.
 */
import type { Page } from '@playwright/test';
import type { Wallet } from 'ethers';

const SHIM_SOURCE = `
(function () {
  if (window.ethereum && window.ethereum.__E2E_SHIM__) return;
  const ADDRESS = window.__E2E_WALLET_ADDRESS__;
  if (!ADDRESS) throw new Error('wallet address not injected');
  const listeners = {};
  const eth = {
    __E2E_SHIM__: true,
    isMetaMask: true,
    chainId: '0x1',
    selectedAddress: ADDRESS,
    networkVersion: '1',
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts': {
          const prev = eth.selectedAddress;
          eth.selectedAddress = ADDRESS;
          if (prev !== ADDRESS) (listeners.accountsChanged || []).forEach((h) => h([ADDRESS]));
          window.dispatchEvent(new Event('ethereum#initialized'));
          return [ADDRESS];
        }
        case 'eth_accounts':
          return [ADDRESS];
        case 'eth_chainId':
          return eth.chainId;
        case 'wallet_requestPermissions':
          return [{ parentCapability: 'wallet_identity', caveats: [], date: Date.now() }];
        case 'personal_sign': {
          const message = Array.isArray(params) ? params[0] : params;
          return await window.__e2e_signPersonal(String(message));
        }
        default:
          if (method === 'net_version') return '1';
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
})();
`;

/**
 * Inject an EIP-1193 wallet shim into the page backed by `privateKey`.
 * Returns the EOA address derived from the key.
 */
export async function injectWallet(page: Page, privateKey: string): Promise<string> {
  const wallet = new (await import('ethers')).Wallet(privateKey);
  const address = wallet.address;
  await exposeWalletSigner(page, wallet);
  await page.addInitScript({
    content: `window.__E2E_WALLET_ADDRESS__ = ${JSON.stringify(address)};`,
  });
  await page.addInitScript({ content: SHIM_SOURCE });
  return address;
}

/**
 * Expose a Node-side `personal_sign` implementation as
 * `window.__e2e_signPersonal(message)` in the page. Use this when the
 * test wants to drive signing itself (e.g. to run a classical SIWE
 * challenge/verify flow inside `page.evaluate`) without standing up the
 * full EIP-1193 provider.
 */
export async function exposeWalletSigner(page: Page, wallet: Wallet): Promise<void> {
  await page.exposeFunction('__e2e_signPersonal', async (message: string) => {
    return await wallet.signMessage(message);
  });
}