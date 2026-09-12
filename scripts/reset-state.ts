#!/usr/bin/env tsx
/**
 * Reset Playwright test state by clearing report directories.
 */
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const targets = [
  'playwright-report',
  'test-results',
  'blob-report',
  '.tsbuildinfo',
];

async function main() {
  for (const target of targets) {
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true });
      // eslint-disable-next-line no-console
      console.log(`removed ${target}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log('reset complete');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
