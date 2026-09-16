/**
 * Wallet — popup: import rejects an invalid mnemonic (WL-UI-009).
 *
 * The mnemonic-import tab validates word count before touching the keyring.
 * `importFromMnemonic` throws '助记词无效，至少需要12个单词' for a phrase with
 * fewer than 12 words, which the controller surfaces as a toast
 * ('导入失败: …') while staying on `#importPage`. The wallet must NOT be
 * created — `#walletPage` never appears.
 *
 * Verified against `js/controller/wallet/import-wallet-controller.js`
 * (error → showError, stays on importPage) and `js/domain/wallet-domain.js`
 * (`importFromMnemonic` word-count guard).
 */
import { test, expect } from '../fixtures';

import { loadWalletContext, teardownWalletContext } from '../helpers/extension';
import { stubPublicEndpoints } from '../helpers/network';
import { byId, openPopup, TEST_PASSWORD } from '../helpers/popup';

// A syntactically-plausible but far-too-short phrase (2 words).
const BAD_MNEMONIC = 'abandon ability';

test('WL-UI-009: an invalid mnemonic is rejected and no wallet is created', async ({
  recorder,
}) => {
  const ctx = await loadWalletContext();
  try {
    await stubPublicEndpoints(ctx.context);
    const popup = await openPopup(ctx.context, ctx.extensionId);

    await byId(popup, 'welcomePage').waitFor({ state: 'visible' });
    await byId(popup, 'welcomeImportWalletBtn').click();
    await byId(popup, 'importPage').waitFor({ state: 'visible' });
    // Mnemonic tab is the default; assert it to be explicit.
    await expect(popup.locator('.import-tab.active')).toHaveAttribute('data-type', 'mnemonic');

    await byId(popup, 'importMnemonic').fill(BAD_MNEMONIC);
    await byId(popup, 'importAccountName').fill('Should Not Exist');
    await byId(popup, 'importWalletPassword').fill(TEST_PASSWORD);
    await recorder.step(popup, '填入非法助记词');
    await byId(popup, 'importBtn').click();

    // A rejection toast appears and we stay on the import page.
    await expect(byId(popup, 'globalToast')).toContainText('助记词无效', { timeout: 10_000 });
    await expect(byId(popup, 'importPage')).toBeVisible();
    await recorder.step(popup, '助记词被拒绝，停留在导入页');

    // The wallet page must never appear (give any faulty async a beat).
    await popup.waitForTimeout(1_500);
    await expect(byId(popup, 'walletPage')).toBeHidden();
  } finally {
    await teardownWalletContext(ctx);
  }
});
