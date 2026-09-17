/**
 * Browser-side EIP-1193 wallet shim for the chat product's UCAN/SIWE login.
 *
 * Chat's wallet login (`app/plugins/wallet.ts`) resolves a provider via
 * `@yeying-community/web3-bs` `getProvider({ preferYeYing: true })`, then builds
 * a root UCAN with a SIWE proof — which signs a statement string through the
 * provider's `personal_sign`. The shim therefore advertises `isYeYing = true`
 * (so discovery selects it immediately, skipping the EIP-6963 timeout) and
 * aliases `window.yeying`.
 *
 * The private key never enters the page: `personal_sign` (and a best-effort
 * `eth_signTypedData_v4`) are proxied to a Node-side ethers `Wallet` via
 * `page.exposeFunction`. SIWE / EIP-191 signatures recover the right address
 * with `ethers.verifyMessage`.
 *
 * This mirrors products/node/helpers/wallet.ts but is named distinctly so it
 * never collides with a helper Chat-B may add.
 */
import type { Page } from '@playwright/test';
import { Wallet } from 'ethers';

const SHIM_SOURCE = `
(function () {
  if (window.ethereum && window.ethereum.__E2E_CHAT_SHIM__) return;
  const ADDRESS = window.__E2E_WALLET_ADDRESS__;
  if (!ADDRESS) throw new Error('wallet address not injected');
  const listeners = {};
  const eth = {
    __E2E_CHAT_SHIM__: true,
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
        case 'eth_signTypedData_v4': {
          const payload = Array.isArray(params) ? params[1] : params;
          return await window.__e2e_signTypedData(String(payload));
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
  // EIP-6963 announce, so discovery that ignores isYeYing still finds it.
  try {
    const info = {
      uuid: '00000000-0000-4000-8000-000000000001',
      name: 'YeYing E2E Wallet',
      icon: 'data:image/svg+xml;base64,PHN2Zy8+',
      rdns: 'pub.yeying.e2e',
    };
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: Object.freeze({ info, provider: eth }),
        }),
      );
    window.addEventListener('eip6963:requestProvider', announce);
    announce();
  } catch (e) {
    // ignore
  }
})();
`;

/**
 * Inject the wallet shim into `page`, backed by `privateKey`. Returns the EOA
 * address. Call before the first navigation so the init scripts and exposed
 * signers are present on every page load.
 */
export async function injectChatWallet(page: Page, privateKey: string): Promise<string> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address;
  await page.exposeFunction('__e2e_signPersonal', async (message: string) =>
    wallet.signMessage(message),
  );
  await page.exposeFunction('__e2e_signTypedData', async (payload: string) => {
    // Best-effort EIP-712 signing; chat's SIWE root proof uses personal_sign,
    // so this is only a fallback for code paths that request typed data.
    try {
      const parsed = JSON.parse(payload);
      const { domain, types, message } = parsed;
      const filteredTypes = { ...types };
      delete filteredTypes.EIP712Domain;
      return await wallet.signTypedData(domain, filteredTypes, message);
    } catch {
      return '0x';
    }
  });
  await page.addInitScript({
    content: `window.__E2E_WALLET_ADDRESS__ = ${JSON.stringify(address)};`,
  });
  await page.addInitScript({ content: SHIM_SOURCE });
  return address;
}

/** A fresh random funding-less wallet, for tests that only need a valid EOA. */
export function freshWalletKey(): string {
  return Wallet.createRandom().privateKey;
}
