#!/usr/bin/env -S node --no-warnings
/**
 * Render Markdown user manuals from `manual/<product>/<spec>/steps.json`
 * produced by the Recorder (see shared/record.ts).
 *
 * Output:
 *   manual/<product>/<spec>/README.md     — per-spec manual section
 *   manual/INDEX.md                       — aggregated table of contents
 *
 * Run: `pnpm manual:build` (or `node --experimental-strip-types scripts/build-manual.ts`)
 */
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { manualRoot, slug } from '../shared/record';

interface StepRecord {
  index: number;
  label: string;
  screenshot: string;
  url?: string;
  note?: string;
}

interface SpecRecording {
  product: string;
  specName: string;
  specFile: string;
  startedAt: string;
  finishedAt?: string;
  passed?: boolean;
  steps: StepRecord[];
}

function relPath(from: string, to: string): string {
  const fromParts = from.split('/');
  const toParts = to.split('/');
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const ups = fromParts.length - i;
  return [...Array(ups).fill('..'), ...toParts.slice(i)].join('/');
}

function renderSpec(specDir: string, rec: SpecRecording): string {
  const lines: string[] = [];
  lines.push(`# ${rec.specName}`);
  lines.push('');
  lines.push(`**Product:** \`${rec.product}\``);
  if (rec.passed !== undefined) {
    lines.push(`**Result:** ${rec.passed ? '✅ pass' : '❌ fail'}`);
  }
  lines.push(`**Source:** \`${rec.specFile.replace(process.cwd() + '/', '')}\``);
  lines.push(`**Recorded:** ${rec.startedAt}${rec.finishedAt ? ` – ${rec.finishedAt}` : ''}`);
  lines.push('');
  for (const step of rec.steps) {
    lines.push(`## ${String(step.index).padStart(2, '0')}. ${step.label}`);
    lines.push('');
    if (step.note) {
      lines.push(`> ${step.note}`);
      lines.push('');
    }
    const imgPath = relPath(specDir, join(specDir, step.screenshot));
    lines.push(`![${step.label}](${step.screenshot})`);
    lines.push('');
    if (step.url && !step.url.startsWith('chrome-extension://')) {
      lines.push(`URL: \`${step.url}\``);
      lines.push('');
    }
  }
  return lines.join('\n');
}

async function loadSpec(dir: string): Promise<{ dir: string; rec: SpecRecording } | null> {
  const stepsPath = join(dir, 'steps.json');
  try {
    const raw = await readFile(stepsPath, 'utf8');
    return { dir, rec: JSON.parse(raw) as SpecRecording };
  } catch {
    return null;
  }
}

async function walkProducts(): Promise<Map<string, Array<{ dir: string; rec: SpecRecording }>>> {
  const out = new Map<string, Array<{ dir: string; rec: SpecRecording }>>();
  let productEntries: import('node:fs').Dirent[];
  try {
    productEntries = await readdir(manualRoot(), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const productEntry of productEntries) {
    if (!productEntry.isDirectory()) continue;
    const productDir = join(manualRoot(), productEntry.name);
    const specDirs = await readdir(productDir, { withFileTypes: true });
    const specs: Array<{ dir: string; rec: SpecRecording }> = [];
    for (const specEntry of specDirs) {
      if (!specEntry.isDirectory()) continue;
      const specDir = join(productDir, specEntry.name);
      const loaded = await loadSpec(specDir);
      if (loaded) specs.push(loaded);
    }
    if (specs.length > 0) {
      out.set(productEntry.name, specs.sort((a, b) => a.rec.startedAt.localeCompare(b.rec.startedAt)));
    }
  }
  return out;
}

function renderIndex(byProduct: Map<string, Array<{ dir: string; rec: SpecRecording }>>): string {
  const lines: string[] = [];
  lines.push('# YeYing Tester — User Manuals');
  lines.push('');
  lines.push('Generated from `manual/<product>/<spec>/steps.json` after each test run.');
  lines.push('Re-run with `pnpm manual:build`.');
  lines.push('');
  for (const [product, specs] of byProduct) {
    lines.push(`## ${product}`);
    lines.push('');
    for (const { rec, dir } of specs) {
      const link = relPath(manualRoot(), join(dir, 'README.md'));
      const status = rec.passed === undefined ? '—' : rec.passed ? '✅' : '❌';
      const stepsCount = rec.steps.length;
      lines.push(`- ${status} [${rec.specName}](${link}) — ${stepsCount} step${stepsCount === 1 ? '' : 's'}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  let manualDirStat;
  try {
    manualDirStat = await stat(manualRoot());
  } catch {
    console.log(`No manual directory at ${manualRoot()}; nothing to render.`);
    console.log('Run some tests with `recorder.step(...)` first.');
    return;
  }
  if (!manualDirStat.isDirectory()) {
    console.error(`${manualRoot()} is not a directory`);
    process.exit(1);
  }
  const byProduct = await walkProducts();
  let totalSpecs = 0;
  for (const [product, specs] of byProduct) {
    for (const { dir, rec } of specs) {
      const md = renderSpec(dir, rec);
      await writeFile(join(dir, 'README.md'), md, 'utf8');
      console.log(`✓ ${product}/${slug(rec.specName)} — ${rec.steps.length} steps`);
      totalSpecs += 1;
    }
  }
  if (totalSpecs === 0) {
    console.log('No steps.json files found.');
    return;
  }
  const index = renderIndex(byProduct);
  await writeFile(join(manualRoot(), 'INDEX.md'), index, 'utf8');
  console.log(`✓ INDEX.md (${totalSpecs} spec${totalSpecs === 1 ? '' : 's'} across ${byProduct.size} product${byProduct.size === 1 ? '' : 's'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});