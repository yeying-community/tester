/**
 * router — authenticated workspace read surfaces.
 *
 * With a seeded wallet session (real SIWE token in localStorage), the three
 * primary workspace pages a user lands on all render behind `PrivateRoute`.
 * This spec proves each one mounts its distinctive content:
 *
 *   - /workspace/topup?tab=quota → 3 quota stat cards (.router-topup-statistic)
 *   - /workspace/token           → the tokens table + 新增令牌 button
 *   - /workspace/log             → the 路由异常概览 heading
 *
 * These are read-only; the token create/delete loop lives in
 * `token-lifecycle.spec.ts` and topup in `topup.spec.ts`.
 *
 * Selectors verified against router `web/src/pages/**` + `web/src/App.jsx`.
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';

import { seedWalletSession } from '../helpers/session';

function skipIfNoService() {
  test.skip(!baseURLFor('router'), 'ROUTER_BASE_URL not configured');
}

test('workspace quota, token and log pages render for an authenticated user', async ({
  page,
  baseURL,
  recorder,
}) => {
  skipIfNoService();
  const env = envFor('router');
  test.skip(!env['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');

  await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
  await seedWalletSession(page, baseURL!, env['ROUTER_WALLET_PRIVATE_KEY']!);

  // --- 额度总览 (quota) ----------------------------------------------------
  await page.goto(`${baseURL}/workspace/topup?tab=quota`, { waitUntil: 'domcontentloaded' });
  // QuotaPage always renders exactly 3 stat cards (totals default to 0).
  await expect(page.locator('.router-topup-statistic')).toHaveCount(3, { timeout: 15_000 });
  await recorder.step(page, '工作台 · 额度总览');

  // --- 令牌 (tokens) -------------------------------------------------------
  await page.goto(`${baseURL}/workspace/token`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.router-list-table')).toBeVisible({ timeout: 15_000 });
  // The UI language follows the browser locale (zh fallback / en when the
  // browser reports en-US), so match either label.
  await expect(page.getByRole('button', { name: /新增令牌|Add Token/ })).toBeVisible();
  await recorder.step(page, '工作台 · 令牌列表');

  // --- 日志 (logs) ---------------------------------------------------------
  await page.goto(`${baseURL}/workspace/log`, { waitUntil: 'domcontentloaded' });
  // The <h2> renders independent of the anomalies fetch, so it is a stable
  // render-proof marker even if the admin log API errors.
  await expect(
    page.getByRole('heading', { level: 2, name: /路由异常概览|Route Anomaly Overview/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await recorder.step(page, '工作台 · 路由异常概览');
});

// RT-UI-021 (P1) — service-purchase page renders the package + balance sections.
test('service-purchase page renders the package and balance sections', async ({
  page,
  baseURL,
  recorder,
}) => {
  skipIfNoService();
  const env = envFor('router');
  test.skip(!env['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');

  await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
  await seedWalletSession(page, baseURL!, env['ROUTER_WALLET_PRIVATE_KEY']!);

  await page.goto(`${baseURL}/workspace/service/pricing`, { waitUntil: 'domcontentloaded' });

  // Both region wrappers always render (ServicePricing/index.jsx), plus the
  // payment-history link in the header.
  await expect(page.locator('#pricing-package-section')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#pricing-balance-section')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.router-service-pricing-history-link')).toBeVisible();
  await recorder.step(page, '服务购买页 · 套餐区与余额充值区');
});
