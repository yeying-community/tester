#!/usr/bin/env tsx
/**
 * Verify that every product's base URL is reachable.
 *
 * Usage:
 *   pnpm env:check                  # check all products
 *   pnpm env:check -- --product=warehouse   # check one product
 *
 * Exit codes:
 *   0 = all configured URLs responded
 *   1 = at least one URL was unreachable OR missing
 */

import { PRODUCT_NAMES, type ProductName } from '../shared/types';
import { baseURLFor, baseURLKey, hasEnv, readEnvFile } from '../shared/env';

interface Row {
  product: ProductName;
  url: string | undefined;
  status: 'ok' | 'down' | 'missing' | 'skipped';
  detail: string;
}

async function checkUrl(url: string, timeoutMs = 5_000): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
    return {
      ok: res.status >= 200 && res.status < 500,
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

function resolveTarget(product: ProductName): { url: string | undefined; fsPath?: string } {
  const url = baseURLFor(product);
  if (url) return { url };
  // marketplace / books fall back to filesystem paths.
  if (product === 'marketplace') {
    return {
      url: undefined,
      fsPath: process.env['MARKETPLACE_REPO_PATH'] ?? readEnvFile('.env', 'MARKETPLACE_REPO_PATH'),
    };
  }
  if (product === 'books') {
    return {
      url: undefined,
      fsPath: process.env['BOOKS_REPO_PATH'] ?? readEnvFile('.env', 'BOOKS_REPO_PATH'),
    };
  }
  if (product === 'wallet') {
    // Wallet is a Chromium MV3 extension; check the directory + manifest.json.
    const path =
      process.env['WALLET_EXTENSION_PATH'] ??
      process.env['WALLET_REPO_PATH'] ??
      readEnvFile('.env', 'WALLET_REPO_PATH') ??
      readEnvFile('.env', 'WALLET_EXTENSION_PATH');
    return { url: undefined, fsPath: path };
  }
  return { url: undefined };
}

async function buildRow(product: ProductName): Promise<Row> {
  const target = resolveTarget(product);
  if (target.fsPath) {
    try {
      const { existsSync, statSync } = await import('node:fs');
      const { join } = await import('node:path');
      if (!existsSync(target.fsPath)) {
        return { product, url: target.fsPath, status: 'down', detail: 'path missing' };
      }
      // For wallet, additionally verify the manifest is present — a directory
      // without manifest.json cannot be loaded as an MV3 extension.
      if (product === 'wallet') {
        const manifestPath = join(target.fsPath, 'manifest.json');
        if (!existsSync(manifestPath)) {
          return { product, url: target.fsPath, status: 'down', detail: 'manifest.json missing' };
        }
        const stat = statSync(manifestPath);
        return { product, url: target.fsPath, status: 'ok', detail: `manifest.json (${stat.size}B)` };
      }
      return { product, url: target.fsPath, status: 'ok', detail: 'path exists' };
    } catch (err) {
      return {
        product,
        url: target.fsPath,
        status: 'down',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }
  if (!target.url) {
    return { product, url: undefined, status: 'missing', detail: `${baseURLKey(product)} not set` };
  }
  const { ok, detail } = await checkUrl(target.url);
  return { product, url: target.url, status: ok ? 'ok' : 'down', detail };
}

function parseArgs(argv: string[]): { product?: ProductName } {
  for (const arg of argv) {
    if (arg.startsWith('--product=')) {
      const value = arg.slice('--product='.length) as ProductName;
      if ((PRODUCT_NAMES as readonly string[]).includes(value)) {
        return { product: value };
      }
    }
  }
  return {};
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = args.product ? [args.product] : [...PRODUCT_NAMES];
  // Avoid touching .env-driven side effects: print which env vars are present.
  if (!hasEnv('NODE_ENV')) process.env['NODE_ENV'] = 'development';

  const rows = await Promise.all(targets.map(buildRow));
  const failed = rows.filter((r) => r.status !== 'ok');

  // eslint-disable-next-line no-console
  console.log('\n┌────────────── env check ──────────────┐');
  // eslint-disable-next-line no-console
  console.log('│ product     │ status  │ target / detail                │');
  // eslint-disable-next-line no-console
  console.log('├─────────────┼─────────┼────────────────────────────────┤');
  for (const row of rows) {
    const target = row.url ?? '—';
    const detail = `${target} ${row.detail}`.slice(0, 30).padEnd(30);
    // eslint-disable-next-line no-console
    console.log(
      `│ ${row.product.padEnd(11)} │ ${row.status.padEnd(7)} │ ${detail} │`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('└─────────────┴─────────┴────────────────────────────────┘');

  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n${failed.length}/${rows.length} targets are not ready.`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`\nAll ${rows.length} targets OK.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
