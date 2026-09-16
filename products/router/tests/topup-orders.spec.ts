/**
 * router — top-up order lifecycle API (RT-API-032 / 033 / 034 / 035).
 *
 * DEGRADED SKIP on this deployment.
 *
 * The live router runs `top_up_mode = "api"` (see GET /api/v1/public/status).
 * In that mode `CreateTopupOrderWithDB` (router
 * `internal/admin/model/topup_order.go`) calls
 * `createTopupOrderByExternalPayAPI` — an outbound request that registers the
 * order with the real third-party payment provider (`config.TopUpLink`,
 * e.g. wp.tidukongjian.com). `RefreshTopupOrderStatusWithDB` and
 * `CancelTopupOrderWithDB` likewise query that provider. Creating / refreshing /
 * cancelling real orders there is the external-payment-provider boundary this
 * suite deliberately does not cross (mirroring the stubbing in
 * `topup.spec.ts`). So when `top_up_mode==='api'` these four cases skip.
 *
 * On a `redirect`-mode deployment order creation is purely local (a redirect URL
 * is built without any provider call), so the full create → list → detail →
 * refresh → cancel flow runs for real. That branch is implemented below and
 * self-cleans by cancelling the order it creates.
 */
import { test, expect, baseURLFor, envFor } from '../fixtures';
import { apiContext } from '../../../shared/api';
import { acquireRouterToken } from '../helpers/auth';

function skipIfNoService() {
  test.skip(!baseURLFor('router'), 'ROUTER_BASE_URL not configured');
}
function skipIfNoKey() {
  test.skip(!envFor('router')['ROUTER_WALLET_PRIVATE_KEY'], 'ROUTER_WALLET_PRIVATE_KEY not configured');
}

async function topUpModeIsExternal(baseURL: string): Promise<boolean> {
  const ctx = await apiContext(baseURL);
  try {
    const body = (await (await ctx.get('/api/v1/public/status')).json()) as {
      data?: { top_up_mode?: string };
    };
    return (body.data?.top_up_mode ?? '').toLowerCase() === 'api';
  } finally {
    await ctx.dispose();
  }
}

const EXTERNAL_REASON =
  'top_up_mode=api: creating/refreshing/cancelling orders hits the real external payment provider (out of scope)';

test.describe('top-up order lifecycle (serial, self-cleaning)', () => {
  test.describe.configure({ mode: 'serial' });
  let createdOrderId = '';

  test.afterAll(async () => {
    if (!createdOrderId) return;
    const baseURL = baseURLFor('router');
    if (!baseURL) return;
    const { token } = await acquireRouterToken(baseURL);
    const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
    await ctx.post(`/api/v1/public/user/topup/orders/${createdOrderId}/cancel`).catch(() => {});
    await ctx.dispose();
  });

  // RT-API-032 (P1)
  test('POST /user/topup/orders creates a balance_topup order', async () => {
    skipIfNoService();
    skipIfNoKey();
    const baseURL = baseURLFor('router')!;
    test.skip(await topUpModeIsExternal(baseURL), EXTERNAL_REASON);

    const { token } = await acquireRouterToken(baseURL);
    const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
    try {
      const plans = (await (await ctx.get('/api/v1/public/user/topup/plans')).json()) as {
        data?: Array<{ id?: string }>;
      };
      const planId = String(plans.data?.[0]?.id ?? '').trim();
      test.skip(!planId, 'no top-up plan available to order');

      const res = await ctx.post('/api/v1/public/user/topup/orders', {
        data: { business_type: 'balance_topup', plan_id: planId },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        success?: boolean;
        data?: { id?: string; transaction_id?: string; status?: string; redirect_url?: string };
      };
      expect(body.success).toBe(true);
      expect(body.data?.id).toBeTruthy();
      expect(body.data?.transaction_id).toBeTruthy();
      expect(['created', 'pending']).toContain(body.data?.status);
      createdOrderId = String(body.data?.id ?? '');
    } finally {
      await ctx.dispose();
    }
  });

  // RT-API-033 (P1)
  test('GET /user/topup/orders lists the order and /orders/:id returns detail', async () => {
    skipIfNoService();
    skipIfNoKey();
    const baseURL = baseURLFor('router')!;
    test.skip(await topUpModeIsExternal(baseURL), EXTERNAL_REASON);
    test.skip(!createdOrderId, 'no order created in this run');

    const { token } = await acquireRouterToken(baseURL);
    const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
    try {
      const list = (await (await ctx.get('/api/v1/public/user/topup/orders')).json()) as {
        success?: boolean;
        data?: { items?: Array<{ id?: string }> };
      };
      expect(list.success).toBe(true);
      expect((list.data?.items ?? []).some(o => String(o.id) === createdOrderId)).toBe(true);

      const detail = (await (await ctx.get(`/api/v1/public/user/topup/orders/${createdOrderId}`)).json()) as {
        success?: boolean;
        data?: { id?: string; amount?: number; currency?: string; status?: string };
      };
      expect(detail.success).toBe(true);
      expect(String(detail.data?.id)).toBe(createdOrderId);
      expect(detail.data?.currency).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });

  // RT-API-034 (P1)
  test('POST /user/topup/orders/:id/refresh returns a normalized status', async () => {
    skipIfNoService();
    skipIfNoKey();
    const baseURL = baseURLFor('router')!;
    test.skip(await topUpModeIsExternal(baseURL), EXTERNAL_REASON);
    test.skip(!createdOrderId, 'no order created in this run');

    const { token } = await acquireRouterToken(baseURL);
    const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
    try {
      const res = await ctx.post(`/api/v1/public/user/topup/orders/${createdOrderId}/refresh`);
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { success?: boolean; data?: { status?: string } };
      expect(body.success).toBe(true);
      expect(['created', 'pending', 'paid', 'fulfilled', 'canceled', 'failed']).toContain(
        body.data?.status,
      );
    } finally {
      await ctx.dispose();
    }
  });

  // RT-API-035 (P1)
  test('POST /user/topup/orders/:id/cancel cancels a pending order', async () => {
    skipIfNoService();
    skipIfNoKey();
    const baseURL = baseURLFor('router')!;
    test.skip(await topUpModeIsExternal(baseURL), EXTERNAL_REASON);
    test.skip(!createdOrderId, 'no order created in this run');

    const { token } = await acquireRouterToken(baseURL);
    const ctx = await apiContext(baseURL, { Authorization: `Bearer ${token}` });
    try {
      const res = await ctx.post(`/api/v1/public/user/topup/orders/${createdOrderId}/cancel`);
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { success?: boolean; data?: { status?: string } };
      expect(body.success).toBe(true);
      expect(body.data?.status).toBe('canceled');
      createdOrderId = ''; // already canceled — nothing for afterAll to clean.
    } finally {
      await ctx.dispose();
    }
  });
});
