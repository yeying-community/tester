/**
 * router — token-row interactions & the token edit page (RT-UI-022 / RT-UI-023).
 *
 * Both require the account to already hold at least one token. Minting a token
 * needs available models (a purchase — the external-payment boundary this suite
 * does not cross), so when the account has no token these cannot be exercised
 * and skip cleanly after a live probe of GET /token/. When a token exists the
 * full interaction runs.
 *
 * Selectors verified against router web/src/components/TokensTable.jsx and
 * web/src/pages/Token/EditToken.jsx.
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';
import { apiContext } from '../../../shared/api';
import { acquireRouterToken } from '../helpers/auth';
import { seedWalletSession } from '../helpers/session';

function skipIfNoService() {
  test.skip(!baseURLFor('router'), 'ROUTER_BASE_URL not configured');
}
function skipIfNoKey() {
  test.skip(
    !envFor('router')['ROUTER_WALLET_PRIVATE_KEY'],
    'ROUTER_WALLET_PRIVATE_KEY not configured',
  );
}

async function firstToken(baseURL: string): Promise<{ id?: string | number; name?: string } | undefined> {
  const { token } = await acquireRouterToken(baseURL);
  const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
  try {
    const body = (await (await ctx.get('/api/v1/public/token/')).json()) as {
      data?: Array<{ id?: string | number; name?: string }>;
    };
    return (body.data ?? [])[0];
  } finally {
    await ctx.dispose();
  }
}

// RT-UI-022 (P2)
test('token row supports copy and enable/disable toggle', async ({ page, baseURL, recorder }) => {
  skipIfNoService();
  skipIfNoKey();
  const existing = await firstToken(baseURL!);
  test.skip(
    !existing?.id,
    'account has no token; minting one needs purchased models (payment boundary), ' +
      'so the token-row copy/toggle interaction cannot be exercised',
  );

  await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
  await seedWalletSession(page, baseURL!, envFor('router')['ROUTER_WALLET_PRIVATE_KEY']!);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.goto(`${baseURL}/workspace/token`, { waitUntil: 'domcontentloaded' });

  const table = page.locator('.router-list-table');
  await expect(table).toBeVisible({ timeout: 15_000 });

  // Copy the token key → success toast appears.
  await page.locator('.router-icon-button').first().click();
  await expect(page.getByText(/复制成功|copied|Copied|copy/i).first()).toBeVisible({ timeout: 10_000 });
  await recorder.step(page, '令牌复制成功');

  // Toggle the status switch → the PUT (?status_only=true) fires and settles.
  const sw = page.locator('.router-token-status-switch').first();
  await expect(sw).toBeVisible();
  const [putRes] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/v1/public/token/') && r.request().method() === 'PUT',
      { timeout: 15_000 },
    ),
    sw.click(),
  ]);
  expect(putRes.ok()).toBe(true);
  await recorder.step(page, '令牌状态切换');

  // Flip it back so the run is side-effect neutral.
  await sw.click().catch(() => {});
});

// RT-UI-023 (P2)
test('the token edit page saves name changes', async ({ page, baseURL, recorder }) => {
  skipIfNoService();
  skipIfNoKey();
  const existing = await firstToken(baseURL!);
  test.skip(
    !existing?.id,
    'account has no token to edit; minting one needs purchased models (payment boundary)',
  );

  await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
  await seedWalletSession(page, baseURL!, envFor('router')['ROUTER_WALLET_PRIVATE_KEY']!);
  await page.goto(`${baseURL}/workspace/token/${existing!.id}`, { waitUntil: 'domcontentloaded' });

  const nameInput = page.locator('input').first();
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  const original = existing!.name ?? (await nameInput.inputValue());
  const newName = `e2e-ui-edit-${Date.now()}`;
  await nameInput.fill(newName);

  const [putRes] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/v1/public/token/') && r.request().method() === 'PUT',
      { timeout: 15_000 },
    ),
    page.getByRole('button', { name: /保存|提交|Save|Submit|确定|确认/ }).first().click(),
  ]);
  const putBody = (await putRes.json()) as { success?: boolean };
  expect(putBody.success).toBe(true);
  await recorder.step(page, '令牌编辑保存');

  // Restore the original name to keep the run side-effect neutral.
  const { token } = await acquireRouterToken(baseURL!);
  const ctx = await apiContext(baseURL!, { Authorization: `Bearer ${token}` });
  await ctx.put('/api/v1/public/token/', { data: { id: existing!.id, name: original, status: 1 } }).catch(() => {});
  await ctx.dispose();
});
