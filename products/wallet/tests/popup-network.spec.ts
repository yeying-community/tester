/**
 * Wallet — popup: network management via the UI.
 *
 * The wallet ships with only its default networks (Ethereum mainnet +
 * YeYing). A user can register a custom network through the network-manage
 * page and then activate it from any network selector. This spec drives
 * that end-to-end through the real popup UI (not the SW message bus that
 * `popup-send-tx` uses for registration):
 *
 *   1. Open the network selector → 网络管理 (manage) page.
 *   2. Add a custom network via the form (#networkFormPage).
 *   3. Confirm it appears in the manage list.
 *   4. Switch to it from a network selector and assert the active label.
 *
 * Selectors verified against `wallet/html/popup.html` and
 * `js/controller/network-controller.js`.
 */
import { test, expect } from '../fixtures';

import { loadWalletContext, teardownWalletContext } from '../helpers/extension';
import { stubPublicEndpoints } from '../helpers/network';
import { byId, createAndUnlockWallet, addCustomNetwork, openTransferPage } from '../helpers/popup';

// A distinctive custom network so we can assert on its label unambiguously.
const NET_NAME = 'E2E Testnet';
const NET_RPC = 'https://e2e.example.invalid/rpc';
const NET_CHAIN_ID = '0x539'; // 1337
const NET_SYMBOL = 'E2E';

test('add a custom network via the UI and switch to it', async ({ recorder }) => {
  const ctx = await loadWalletContext();
  try {
    await stubPublicEndpoints(ctx.context);
    // Switching networks calls eth_chainId against the new RPC; an
    // unreachable RPC makes the switch throw and revert. Stub our custom
    // host with a minimal JSON-RPC responder so the switch succeeds
    // without a live dependency.
    await ctx.context.route('https://e2e.example.invalid/**', async (route) => {
      let method = '';
      let id: unknown = 1;
      try {
        const body = route.request().postDataJSON() as { method?: string; id?: unknown };
        method = body?.method ?? '';
        id = body?.id ?? 1;
      } catch {
        // non-JSON body; fall through with defaults
      }
      const result = method === 'eth_getBalance' ? '0x0' : NET_CHAIN_ID;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id, result }),
      });
    });
    const popup = await createAndUnlockWallet(ctx.context, ctx.extensionId);
    await recorder.step(popup, '创建并解锁钱包');

    // Open the tokens-tab network selector and jump into 网络管理.
    const selector = popup.locator('#tokensContent [data-network-selector="true"]').first();
    await selector.locator('.network-trigger').click();
    await popup.locator('#tokensContent .network-menu').waitFor({ state: 'visible' });
    await popup.locator('.network-option-manage').first().click();

    await byId(popup, 'networkManagePage').waitFor({ state: 'visible' });
    await recorder.step(popup, '进入网络管理页');

    // Add a new network.
    await byId(popup, 'networkAddBtn').click();
    await byId(popup, 'networkFormPage').waitFor({ state: 'visible' });
    await byId(popup, 'networkNameInput').fill(NET_NAME);
    await byId(popup, 'networkRpcInput').fill(NET_RPC);
    await byId(popup, 'networkChainIdInput').fill(NET_CHAIN_ID);
    await byId(popup, 'networkSymbolInput').fill(NET_SYMBOL);
    await recorder.step(popup, '填写自定义网络表单');
    await byId(popup, 'saveNetworkBtn').click();

    // Back on the manage page, the new network should be listed.
    await byId(popup, 'networkManagePage').waitFor({ state: 'visible' });
    await expect(
      byId(popup, 'networkManageList').locator('.network-item-title', { hasText: NET_NAME }),
    ).toBeVisible({ timeout: 10_000 });
    await recorder.step(popup, '自定义网络已加入列表');

    // Go back to the wallet page and switch to the new network via a selector.
    await popup.locator('#networkManagePage .back-btn:visible').first().click();
    await byId(popup, 'walletPage').waitFor({ state: 'visible' });

    const sel2 = popup.locator('#tokensContent [data-network-selector="true"]').first();
    await sel2.locator('.network-trigger').click();
    const option = popup.locator(
      `#tokensContent .network-option[data-value="${NET_RPC}"]`,
    );
    await option.waitFor({ state: 'visible', timeout: 5_000 });
    await option.click();
    await recorder.step(popup, '切换到自定义网络');

    await expect(sel2.locator('.network-label')).toHaveText(NET_NAME, { timeout: 5_000 });
  } finally {
    await teardownWalletContext(ctx);
  }
});

// WL-UI-020: switching to a network whose RPC is unreachable must fail
// loudly and leave the active network unchanged (no silent partial switch).
const UNREACHABLE_NAME = 'Unreachable E2E';
const UNREACHABLE_RPC = 'https://unreachable.e2e.invalid/rpc';
const UNREACHABLE_CHAIN_ID = '0x2694'; // 9876

test('WL-UI-020: switching to an unreachable RPC fails and keeps the current network', async ({
  recorder,
}) => {
  const ctx = await loadWalletContext();
  try {
    await stubPublicEndpoints(ctx.context);
    // The custom RPC host is unreachable: every request aborts.
    await ctx.context.route(`${UNREACHABLE_RPC}**`, (route) => route.abort('connectionfailed'));
    await ctx.context.route('https://unreachable.e2e.invalid/**', (route) =>
      route.abort('connectionfailed'),
    );

    const popup = await createAndUnlockWallet(ctx.context, ctx.extensionId);

    // Register the broken network directly (ADD_CUSTOM_NETWORK never calls
    // the RPC, so it stores fine even though the host is dead).
    const added = await addCustomNetwork(popup, {
      chainName: UNREACHABLE_NAME,
      chainId: UNREACHABLE_CHAIN_ID,
      rpcUrl: UNREACHABLE_RPC,
      symbol: 'ETH',
    });
    expect(added.success, `add network failed: ${added.error}`).toBe(true);

    // Entering the transfer page refreshes the selector so the new (broken)
    // network becomes selectable.
    await openTransferPage(popup);
    const selector = popup.locator('#transferPage [data-network-selector="true"]').first();
    const labelBefore = (await selector.locator('.network-label').textContent())?.trim();
    await recorder.step(popup, `当前网络: ${labelBefore}`);

    await selector.locator('.network-trigger').click();
    const option = selector.locator(`.network-option[data-value="${UNREACHABLE_RPC}"]`);
    await option.waitFor({ state: 'visible', timeout: 5_000 });
    await option.click();
    await recorder.step(popup, '尝试切换到不可达网络');

    // The switch throws → error toast, and the active label is unchanged.
    await expect(byId(popup, 'globalToast')).toContainText('切换网络失败', { timeout: 15_000 });
    await expect
      .poll(async () => (await selector.locator('.network-label').textContent())?.trim(), {
        timeout: 5_000,
      })
      .toBe(labelBefore);
    await recorder.step(popup, '切换失败，网络回退到原网络');
  } finally {
    await teardownWalletContext(ctx);
  }
});
