/**
 * Helpers for driving the wallet's popup and approval UIs.
 *
 * The wallet's MV3 extension has two UI surfaces:
 *
 *   1. **Popup** (`html/popup.html`) — the main 380×600 view that owns the
 *      keyring, account list, transfer screen, etc. Opened via
 *      `chrome-extension://<id>/html/popup.html`.
 *   2. **Approval window** (`html/approval.html`) — a *separate*
 *      `chrome.windows.create({ type: 'popup' })` window that appears
 *      whenever a dApp requests an unlock-required action
 *      (`eth_requestAccounts`, `personal_sign`, etc.). The Playwright
 *      context fires a new `page` event when this window opens.
 *
 * Selectors are copied from `wallet/tests/e2e/extension-smoke.test.mjs`,
 * which is the source of truth for popup flows.
 */
import type { BrowserContext, Page } from '@playwright/test';

import { getExtensionId } from './extension';

/** Default popup dimensions — mirror `js/config/ui-config.js:POPUP_DIMENSIONS`. */
export const POPUP_WIDTH = 380;
export const POPUP_HEIGHT = 600;

export const SELECTORS = {
  welcomePage: '#welcomePage',
  welcomeCreateWalletBtn: '#welcomeCreateWalletBtn',
  welcomeImportWalletBtn: '#welcomeImportWalletBtn',

  setPasswordPage: '#setPasswordPage',
  setWalletName: '#setWalletName',
  setPasswordBtn: '#setPasswordBtn',
  passwordPromptInput: '#passwordPromptInput',
  passwordPromptConfirm: '#passwordPromptConfirm',

  walletPage: '#walletPage',
  accountAddress: '#accountAddress',
  accountName: '#accountName',
  walletHeaderMenuBtn: '#walletHeaderMenuBtn',
  walletHeaderMenu: '#walletHeaderMenu',
  lockWalletBtn: '#lockWalletBtn',

  // Account switcher (header) + accounts management page.
  accountHeader: '#accountHeader',
  accountDropdownBtn: '#accountDropdownBtn',
  accountSwitcherMenu: '#accountSwitcherMenu',
  accountSwitcherList: '#accountSwitcherList',
  manageAccountsBtn: '#manageAccountsBtn',
  accountsPage: '#accountsPage',
  walletList: '#walletList',
  createAccountModal: '#createAccountModal',
  newAccountName: '#newAccountName',
  confirmCreateAccount: '#confirmCreateAccount',

  // Account detail page (rename + QR / receive).
  accountDetailPage: '#accountDetailPage',
  accountDetailNameText: '#accountDetailNameText',
  editAccountNameBtn: '#editAccountNameBtn',
  accountDetailNameInput: '#accountDetailNameInput',
  saveAccountNameBtn: '#saveAccountNameBtn',
  accountDetailAddress: '#accountDetailAddress',
  accountDetailQr: '#accountDetailQr',
  copyAccountAddressBtn: '#copyAccountAddressBtn',

  // Activity tab + transaction history.
  activityTab: '#activityTab',
  transactionList: '#transactionList',
  clearTransactionsBtn: '#clearTransactionsBtn',

  // Contacts (address book).
  contactsBtn: '#contactsBtn',
  contactsPage: '#contactsPage',
  contactsList: '#contactsList',
  openAddContactBtn: '#openAddContactBtn',
  contactEditorModal: '#contactEditorModal',
  contactNameInput: '#contactNameInput',
  contactAddressInput: '#contactAddressInput',
  addContactBtn: '#addContactBtn',
  contactSelectorBtn: '#contactSelectorBtn',
  contactMenu: '#contactMenu',

  // Network management page + add/edit form.
  networkManagePage: '#networkManagePage',
  networkAddBtn: '#networkAddBtn',
  networkManageList: '#networkManageList',
  networkFormPage: '#networkFormPage',
  networkNameInput: '#networkNameInput',
  networkRpcInput: '#networkRpcInput',
  networkChainIdInput: '#networkChainIdInput',
  networkSymbolInput: '#networkSymbolInput',
  networkExplorerInput: '#networkExplorerInput',
  saveNetworkBtn: '#saveNetworkBtn',

  // Settings + security modals.
  settingsBtn: '#settingsBtn',
  settingsPage: '#settingsPage',
  changePasswordBtn: '#changePasswordBtn',
  changePasswordModal: '#changePasswordModal',
  oldPasswordInput: '#oldPasswordInput',
  newPasswordInput: '#newPasswordInput',
  confirmNewPasswordInput: '#confirmNewPasswordInput',
  confirmChangePasswordBtn: '#confirmChangePasswordBtn',
  secretDisplayModal: '#secretDisplayModal',
  secretDisplayValue: '#secretDisplayValue',
  confirmSecretDisplayBtn: '#confirmSecretDisplayBtn',

  // Dynamic password-prompt modal (created on demand).
  passwordPromptModal: '#passwordPromptModal',
  passwordPromptClose: '#passwordPromptClose',

  unlockPage: '#unlockPage',
  unlockPassword: '#unlockPassword',
  unlockBtn: '#unlockBtn',
  globalToast: '#globalToast',

  globalWaitingOverlay: '#globalWaitingOverlay',

  transferPage: '#transferPage',
  transferBtn: '#transferBtn',
  recipientAddress: '#recipientAddress',
  amount: '#amount',
  sendBtn: '#sendBtn',

  importPage: '#importPage',
  importMnemonic: '#importMnemonic',
  importPrivateKey: '#importPrivateKey',
  importWalletPassword: '#importWalletPassword',
  importBtn: '#importBtn',
  importAccountName: '#importAccountName',
} as const;

/** Open the main popup (380×600) and return the page. */
export async function openPopup(context: BrowserContext, extensionId?: string): Promise<Page> {
  const id = extensionId ?? (await getExtensionId(context));
  const page = await context.newPage();
  await page.setViewportSize({ width: POPUP_WIDTH, height: POPUP_HEIGHT });
  await page.goto(`chrome-extension://${id}/html/popup.html`);
  return page;
}

/** Convenience for typed lookups; returns a Playwright Locator. */
export function byId(page: Page, key: keyof typeof SELECTORS) {
  const sel = SELECTORS[key];
  return page.locator(sel);
}

/** Default password + wallet name used by setup helpers. */
export const TEST_PASSWORD = 'E2E-password-2026';
export const TEST_WALLET_NAME = 'E2E Wallet';

/**
 * Create + unlock a fresh wallet in the given context and return the
 * popup page once `#walletPage` is visible. Used by all popup specs
 * that need a ready state without re-implementing the welcome →
 * set-password dance.
 */
export async function createAndUnlockWallet(
  context: BrowserContext,
  extensionId: string,
  options?: { password?: string; walletName?: string },
): Promise<Page> {
  const password = options?.password ?? TEST_PASSWORD;
  const walletName = options?.walletName ?? TEST_WALLET_NAME;
  const popup = await openPopup(context, extensionId);
  await byId(popup, 'welcomePage').waitFor({ state: 'visible' });
  await byId(popup, 'welcomeCreateWalletBtn').click();
  await byId(popup, 'setPasswordPage').waitFor({ state: 'visible' });
  await byId(popup, 'setWalletName').fill(walletName);
  await byId(popup, 'setPasswordBtn').click();
  await byId(popup, 'passwordPromptInput').fill(password);
  await byId(popup, 'passwordPromptConfirm').click();
  await byId(popup, 'walletPage').waitFor({ state: 'visible', timeout: 30_000 });
  return popup;
}

/**
 * Send a message to the extension's service worker from an extension page
 * (popup / approval). The SW's `chrome.runtime.onMessage` handler expects
 * `{ type, data }` and returns the handler's result object.
 */
export async function sendSw<T = unknown>(
  page: Page,
  type: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  return page.evaluate(
    async ({ type, data }) =>
      (globalThis as any).chrome.runtime.sendMessage({ type, data }),
    { type, data },
  ) as Promise<T>;
}

export interface CustomNetworkSpec {
  chainName: string;
  chainId: string; // hex, e.g. '0x539'
  rpcUrl: string;
  symbol?: string;
  explorer?: string;
  decimals?: number;
}

/**
 * Register a custom network directly through the SW message bus
 * (`ADD_CUSTOM_NETWORK`). This does NOT touch the RPC — it only validates
 * and stores — so it works even when the network's RPC is stubbed/aborted.
 * Returns `{ success, network?, error? }`.
 */
export async function addCustomNetwork(
  popup: Page,
  net: CustomNetworkSpec,
): Promise<{ success: boolean; network?: unknown; error?: string }> {
  return sendSw(popup, 'ADD_CUSTOM_NETWORK', {
    chainName: net.chainName,
    chainId: net.chainId,
    rpcUrl: net.rpcUrl,
    explorer: net.explorer ?? '',
    symbol: net.symbol ?? 'ETH',
    decimals: net.decimals ?? 18,
  });
}

/**
 * Open the transfer page. Entering it calls `prepareTransferSelectors`,
 * which refreshes the network-selector options — so any network registered
 * via {@link addCustomNetwork} after the popup loaded becomes selectable.
 */
export async function openTransferPage(popup: Page): Promise<void> {
  await byId(popup, 'transferBtn').click();
  await byId(popup, 'transferPage').waitFor({ state: 'visible' });
}

/**
 * On the transfer page, open the network selector and pick the option whose
 * `data-value` is `rpcUrl`. Returns the selector locator so callers can
 * assert on the resulting `.network-label`.
 */
export async function pickTransferNetwork(popup: Page, rpcUrl: string) {
  const selector = popup.locator('#transferPage [data-network-selector="true"]').first();
  await selector.locator('.network-trigger').click();
  const option = selector.locator(`.network-option[data-value="${rpcUrl}"]`);
  await option.waitFor({ state: 'visible', timeout: 5_000 });
  await option.click();
  return selector;
}

/**
 * Wait for the next approval window to open, return it.
 *
 * `requestType` filters by the `type=...` query parameter the wallet uses
 * (`connect`, `transaction`, `sign`, `profile`). If omitted, returns the
 * first approval window regardless of type.
 *
 * The approval window has the URL pattern
 * `chrome-extension://<id>/html/approval.html?requestId=...&type=<type>`.
 */
export async function waitForApproval(
  context: BrowserContext,
  extensionId: string,
  options: { requestType?: string; timeout?: number } = {},
): Promise<Page> {
  const { requestType, timeout = 30_000 } = options;

  const approvalPage = await context.waitForEvent('page', {
    predicate: (page) => {
      const url = page.url();
      if (!url.startsWith(`chrome-extension://${extensionId}/html/approval.html`)) return false;
      if (!requestType) return true;
      return new URL(url).searchParams.get('type') === requestType;
    },
    timeout,
  });
  await approvalPage.bringToFront();
  await approvalPage.setViewportSize({ width: POPUP_WIDTH, height: POPUP_HEIGHT });
  await approvalPage.waitForLoadState('domcontentloaded');
  await approvalPage.locator('.request-view:not(.hidden)').first().waitFor({
    state: 'visible',
    timeout,
  });
  return approvalPage;
}
