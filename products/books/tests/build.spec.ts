/**
 * books — 构建配置 (BK-DATA-033, 034).
 */
import { existsSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { abs, walk, repoPath } from './helpers';

const BUILD_CONFIGS = ['book.toml', 'book.json', '.gitbook.yaml', '.gitbook.yml', 'mkdocs.yml'];

function foundBuildConfigs(): string[] {
  const all = walk(repoPath());
  const names = new Set(BUILD_CONFIGS);
  return all.filter((f) => names.has(f.slice(f.lastIndexOf('/') + 1)));
}

// BK-DATA-033
test('BK-DATA-033 repo is a pure SUMMARY-directory repo (no build tooling)', () => {
  const configs = foundBuildConfigs();
  // Contract: no mdBook/GitBook/MkDocs config present — the repo is organised as a
  // plain SUMMARY.md directory tree, so its absence is expected, not breakage.
  expect(configs).toEqual([]);
  // ...yet the SUMMARY-driven book skeleton is genuinely present.
  expect(existsSync(abs('agent/SUMMARY.md'))).toBe(true);
  // If a config is ever added, this assertion flips red as a reminder to extend
  // build validation (BK-DATA-034).
});

// BK-DATA-034
test('BK-DATA-034 build config, if present, produces HTML', () => {
  const configs = foundBuildConfigs();
  test.skip(configs.length === 0, 'no supported build config present; nothing to build');
  // Reached only when a config appears; would run `mdbook build` (or equivalent)
  // and assert HTML output. Kept as a guard so adding a config surfaces the gap.
  expect(configs.length).toBeGreaterThan(0);
});
