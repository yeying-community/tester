#!/usr/bin/env tsx
/**
 * Print a summary of all configured products and the env vars each one expects.
 *
 * Usage: pnpm env:list
 */
import { PRODUCT_NAMES } from '../shared/types';
import { baseURLFor, baseURLKey } from '../shared/env';

interface Row {
  product: string;
  baseURL: string | undefined;
  status: 'configured' | 'unset';
}

function buildRow(product: string): Row {
  const url = baseURLFor(product as (typeof PRODUCT_NAMES)[number]);
  return {
    product,
    baseURL: url,
    status: url ? 'configured' : 'unset',
  };
}

function main() {
  const rows = PRODUCT_NAMES.map(buildRow);
  // eslint-disable-next-line no-console
  console.log('\n┌──────────── product env summary ────────────┐');
  // eslint-disable-next-line no-console
  console.log('│ product     │ env var               │ status      │');
  // eslint-disable-next-line no-console
  console.log('├─────────────┼───────────────────────┼─────────────┤');
  for (const row of rows) {
    const key = baseURLKey(row.product as (typeof PRODUCT_NAMES)[number]);
    // eslint-disable-next-line no-console
    console.log(
      `│ ${row.product.padEnd(11)} │ ${key.padEnd(21)} │ ${row.status.padEnd(11)} │`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('└─────────────┴───────────────────────┴─────────────┘');
  // eslint-disable-next-line no-console
  console.log('\nRun `pnpm env:check` to verify reachability.');
}

main();
