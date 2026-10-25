/**
 * router — shared model center status and ranking views (RT-UI-027..031).
 *
 * These UI-contract tests use anonymous request fixtures instead of wallet
 * credentials. They exercise the real Router SPA, routing, responsive CSS,
 * URL state and role-dependent rendering while keeping model usage data
 * deterministic and avoiding writes to a shared Router deployment.
 *
 * Environment: ROUTER_BASE_URL (point it at the Router frontend under test).
 */
import type { Page, Route } from '@playwright/test';

import { localizedTitle } from '../../../shared/title';
import { test, expect, baseURLFor } from '../fixtures';

const generatedAt = 1_800_000_000;

function skipIfNoService() {
  test.skip(!baseURLFor('router'), 'ROUTER_BASE_URL not configured');
}

function healthPoints() {
  return Array.from({ length: 60 }, (_, index) => {
    const observed = index >= 5 && index % 11 !== 0;
    const state = !observed
      ? 'unknown'
      : index % 17 === 0
        ? 'failure'
        : index % 7 === 0
          ? 'warning'
          : 'success';
    const total = observed ? 12 + (index % 5) : 0;
    const failures = state === 'failure' ? 4 : state === 'warning' ? 1 : 0;
    return {
      state,
      bucket_start: generatedAt - (60 - index) * 300,
      bucket_end: generatedAt - (59 - index) * 300,
      success_count: total - failures,
      failure_count: failures,
      total_count: total,
      avg_latency_ms: observed ? 700 + index * 10 : 0,
      last_observed_at: observed ? generatedAt - (59 - index) * 300 : 0,
      pass_rate: total > 0 ? (total - failures) / total : 0,
    };
  });
}

const modelStatusPayload = {
  group: 'all',
  generated_at: generatedAt,
  summary: {
    model_count: 2,
    healthy_model_count: 1,
    warning_model_count: 1,
    critical_model_count: 0,
    unknown_model_count: 0,
    avg_pass_rate: 0.93,
    avg_latency_ms: 1_420,
  },
  models: [
    {
      model: 'gpt-5.1',
      provider: 'OpenAI',
      health_level: 'healthy',
      health_score: 96,
      health_source: 'traffic',
      channel_count: 3,
      channel_ids: ['11', '12', '13'],
      tested_channel_count: 3,
      tested_endpoint_count: 2,
      supported_count: 2,
      unsupported_count: 0,
      pass_rate: 0.992,
      avg_latency_ms: 840,
      last_signal_at: generatedAt - 60,
      supported_endpoints: ['/v1/chat/completions', '/v1/responses'],
      tags: ['推理', '工具调用'],
      health_points: healthPoints(),
    },
    {
      model: 'claude-sonnet-4-5-20250929',
      provider: 'Anthropic',
      health_level: 'warning',
      health_score: 72,
      health_source: 'probe',
      channel_count: 2,
      channel_ids: ['21', '22'],
      tested_channel_count: 2,
      tested_endpoint_count: 1,
      supported_count: 1,
      unsupported_count: 0,
      pass_rate: 0.861,
      avg_latency_ms: 2_140,
      last_signal_at: generatedAt - 420,
      supported_endpoints: ['/v1/messages'],
      tags: ['长上下文'],
      health_points: healthPoints(),
    },
  ],
};

function rankingPayload(scope: 'me' | 'global', period: string, isAdmin: boolean) {
  const baseItems = [
    {
      rank: 1,
      model: 'gpt-5.1',
      provider: 'OpenAI',
      published: true,
      tags: ['推理'],
      sample_state: 'sufficient',
      suppressed: false,
      request_count: scope === 'me' ? 982 : 18_240,
      share_rate: 0.62,
      prompt_tokens: 60_000_000,
      output_tokens: 36_200_000,
      total_tokens: 96_200_000,
      spend_quota: 4_820_000,
      last_used_at: generatedAt - 60,
      health_level: 'healthy',
      health_score: 96,
      pass_rate: 0.992,
      avg_latency_ms: 840,
      last_signal_at: generatedAt - 60,
      channel_count: 3,
      supported_endpoint_count: 2,
    },
    {
      rank: 2,
      model: 'claude-sonnet-4-5-20250929',
      provider: 'Anthropic',
      published: true,
      tags: ['长上下文'],
      sample_state: 'sufficient',
      suppressed: false,
      request_count: scope === 'me' ? 541 : 11_320,
      share_rate: 0.38,
      prompt_tokens: 40_000_000,
      output_tokens: 22_100_000,
      total_tokens: 62_100_000,
      spend_quota: 3_920_000,
      last_used_at: generatedAt - 200,
      health_level: 'warning',
      health_score: 72,
      pass_rate: 0.861,
      avg_latency_ms: 2_140,
      last_signal_at: generatedAt - 420,
      channel_count: 2,
      supported_endpoint_count: 1,
    },
  ];
  const items = [...baseItems];
  if (scope === 'me') {
    items.push({
      ...baseItems[1]!,
      rank: 3,
      model: 'retired-personal-model',
      provider: '历史记录',
      published: false,
      tags: [],
      sample_state: 'sufficient',
      suppressed: false,
      request_count: 22,
      share_rate: 0.01,
      total_tokens: 73_400,
      prompt_tokens: 50_000,
      output_tokens: 23_400,
      spend_quota: 0,
      health_level: 'unknown',
      health_score: 0,
      pass_rate: 0,
      avg_latency_ms: 0,
      last_signal_at: 0,
      channel_count: 0,
      supported_endpoint_count: 0,
    });
  } else if (!isAdmin) {
    items.push({
      ...baseItems[1]!,
      rank: 0,
      model: 'small-private-model',
      provider: 'Private',
      published: true,
      tags: [],
      sample_state: 'insufficient',
      suppressed: true,
      request_count: 0,
      share_rate: 0,
      prompt_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      spend_quota: 0,
      last_used_at: 0,
      health_level: 'unknown',
      health_score: 0,
      pass_rate: 0,
      avg_latency_ms: 0,
      last_signal_at: 0,
      channel_count: 1,
      supported_endpoint_count: 0,
    });
  }
  return {
    scope,
    period,
    start_at:
      generatedAt - (period === 'last_30_days' ? 30 : period === 'last_24_hours' ? 1 : 7) * 86_400,
    end_at: generatedAt,
    generated_at: generatedAt,
    total_request_count: items.reduce((sum, item) => sum + item.request_count, 0),
    total_tokens: items.reduce((sum, item) => sum + item.total_tokens, 0),
    public_min_request_count: 5,
    public_min_distinct_users: 2,
    items,
  };
}

async function installModelCenterFixtures(page: Page, role: number) {
  const user = {
    id: role >= 10 ? 1 : 101,
    username: role >= 10 ? 'model-admin' : 'model-user',
    display_name: role >= 10 ? '模型管理员' : '模型用户',
    role,
    quota: 1_000_000,
    token: 'fixture-token',
  };
  await page.addInitScript((seededUser) => {
    localStorage.setItem('user', JSON.stringify(seededUser));
    localStorage.setItem('i18nextLng', 'zh');
  }, user);

  const fulfill = async (route: Route, data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });

  await page.route('**/api/v1/public/status', (route) =>
    fulfill(route, {
      system_name: 'Router',
      logo: '',
      footer_html: '',
      quota_per_unit: 500_000,
      version: 'v0.0.0',
      wallet_login: true,
    }),
  );
  await page.route('**/api/v1/public/model/status', (route) => fulfill(route, modelStatusPayload));
  await page.route('**/api/v1/public/model/ranking*', async (route) => {
    const url = new URL(route.request().url());
    const scope = url.searchParams.get('scope') === 'global' ? 'global' : 'me';
    const period = url.searchParams.get('period') || 'last_7_days';
    await fulfill(route, rankingPayload(scope, period, role >= 10));
  });
  await page.route('**/api/v1/public/user/self', (route) => fulfill(route, user));
  await page.route('**/api/v1/public/user/self/notification', (route) =>
    fulfill(route, { low_balance_threshold: 0, default_threshold: 0 }),
  );
  await page.route('**/api/v1/public/user/topup/balance/summary', (route) =>
    fulfill(route, { total_balance_amount: 100 }),
  );
  await page.route('**/api/v1/public/user/onboarding/progress', (route) =>
    fulfill(route, {
      has_token: true,
      has_balance_or_package: true,
      has_api_call: true,
      email_bound: true,
    }),
  );
  await page.route('**/api/v1/public/notice', (route) => fulfill(route, []));
  await page.route('**/api/v1/public/user/tasks*', (route) =>
    fulfill(route, { items: [], total: 0 }),
  );
  await page.route('**/api/v1/admin/channel/alerts*', (route) =>
    fulfill(route, {
      items: [],
      summary: { active_total: 0, unresolved_critical: 0, unacknowledged: 0, last_24h: 0 },
    }),
  );
}

test(
  localizedTitle(
    '【模型中心 / UI】 运行状态固定展示最近五小时并在移动端和深色模式保持可读',
    'model health shows the fixed five-hour window and stays usable on mobile and dark mode',
  ),
  async ({ page, baseURL, recorder }) => {
    skipIfNoService();
    await installModelCenterFixtures(page, 0);
    await page.goto(`${baseURL}/workspace/service/models?tab=health`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('heading', { level: 1, name: '模型中心' })).toBeAttached();
    await expect(page.getByRole('tab', { name: '运行状态' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('最近 5 小时 · 每格 5 分钟')).toBeVisible();
    await expect(page.getByText('无样本', { exact: true })).toBeVisible();
    await expect(page.locator('.workspace-model-card')).toHaveCount(2);
    await expect(
      page.locator('.workspace-model-card').first().locator('.workspace-model-health-cell'),
    ).toHaveCount(60);

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => {
        const g = globalThis as unknown as {
          document: { documentElement: { scrollWidth: number } };
        };
        return g.document.documentElement.scrollWidth;
      }),
    ).toBe(390);

    await page.evaluate(() => localStorage.setItem('router.theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.workspace-model-section-heading')).toBeVisible();
    const darkColors = await page.evaluate(() => {
      const g = globalThis as unknown as {
        document: { querySelector: (selector: string) => unknown | null };
        getComputedStyle: (element: unknown) => { backgroundColor: string; color: string };
      };
      const main = g.document.querySelector('.router-admin-main');
      const title = g.document.querySelector('.workspace-model-section-heading');
      return {
        main: main ? g.getComputedStyle(main).backgroundColor : '',
        title: title ? g.getComputedStyle(title).color : '',
      };
    });
    expect(darkColors.main).not.toBe('rgba(0, 0, 0, 0)');
    expect(darkColors.main).not.toBe(darkColors.title);
    await recorder.step(page, '模型中心 · 五小时健康状态 / 移动端 / 深色模式');
  },
);

test(
  localizedTitle(
    '【模型中心 / UI】 普通用户排行恢复 URL 状态并保护全站低样本数据',
    'user ranking restores URL state and protects low-sample global usage',
  ),
  async ({ page, baseURL, recorder }) => {
    skipIfNoService();
    await installModelCenterFixtures(page, 0);
    const path = '/workspace/service/models?tab=ranking&period=last_30_days&q=gpt';
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: '使用排行' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.workspace-models-search')).toHaveValue('gpt');
    await expect(page.locator('.workspace-model-ranking-period')).toContainText('近 30 天');
    await expect(page.locator('.workspace-model-ranking-row')).toHaveCount(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp('tab=ranking.*period=last_30_days.*q=gpt'));
    await expect(page.locator('.workspace-models-search')).toHaveValue('gpt');

    await page.locator('.workspace-models-search').fill('');
    await page.getByText('全站偏好', { exact: true }).click();
    await expect(page).toHaveURL(/scope=global/);
    await expect(page.locator('.workspace-model-ranking-privacy-note')).toContainText(
      '至少 5 次调用且来自至少 2 位用户',
    );
    const suppressed = page.locator('.workspace-model-ranking-row.is-suppressed');
    await expect(suppressed).toContainText('small-private-model');
    await expect(suppressed).toContainText('样本不足');
    await expect(suppressed).not.toContainText('调用量');
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(2);
    await recorder.step(page, '模型中心 · 个人排行 / URL 恢复 / 全站隐私阈值');
  },
);

test(
  localizedTitle(
    '【模型中心 / UI】 管理员默认全站排行并显示运营字段与日志入口',
    'admin defaults to global ranking and sees operational fields and log links',
  ),
  async ({ page, baseURL, recorder }) => {
    skipIfNoService();
    await installModelCenterFixtures(page, 10);
    await page.goto(`${baseURL}/workspace/service/models?tab=ranking`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).toHaveURL(/tab=ranking.*scope=global/);
    for (const heading of ['运营数据', '当前状态', '操作']) {
      await expect(page.getByRole('columnheader', { name: heading })).toBeVisible();
    }
    const firstRow = page.locator('.workspace-model-ranking-row').first();
    await expect(firstRow).toContainText('调用量');
    await expect(firstRow).toContainText('Tokens');
    await expect(firstRow).toContainText('消费');
    await expect(firstRow).toContainText('覆盖渠道');
    await expect(firstRow.getByRole('button', { name: '查看日志' })).toBeVisible();

    await page.getByText('我的使用', { exact: true }).click();
    await expect(page).not.toHaveURL(/scope=global/);
    await expect(page.getByRole('radio', { name: '我的使用' })).toBeChecked();

    await page.getByText('全站偏好', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => {
      const g = globalThis as unknown as {
        document: {
          documentElement: { scrollWidth: number };
          querySelector: (
            selector: string,
          ) => { getBoundingClientRect: () => { top: number } } | null;
        };
        innerWidth: number;
      };
      return {
        scrollWidth: g.document.documentElement.scrollWidth,
        viewport: g.innerWidth,
        periodTop: g.document
          .querySelector('.workspace-model-ranking-period')
          ?.getBoundingClientRect().top,
        refreshTop: g.document.querySelector('.workspace-models-refresh')?.getBoundingClientRect()
          .top,
      };
    });
    expect(layout.scrollWidth).toBe(layout.viewport);
    expect(layout.periodTop).toBe(layout.refreshTop);
    await expect(firstRow.getByRole('button', { name: '查看日志' })).toBeVisible();
    await recorder.step(page, '模型中心 · 管理员运营排行 / 个人切换 / 移动端');
  },
);
