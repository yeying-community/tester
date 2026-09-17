/**
 * books — Markdown 基本合法性 (BK-DATA-025, 026, 027, 028).
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { abs, readText, allMarkdown, stripFences } from './helpers';

function relOf(file: string): string {
  return file.slice(abs('.').length + 1);
}

// BK-DATA-025
test('BK-DATA-025 every markdown file is valid UTF-8 (no replacement chars)', () => {
  const bad: string[] = [];
  for (const file of allMarkdown()) {
    const buf = readFileSync(file);
    const text = buf.toString('utf8');
    // U+FFFD appears when bytes fail to decode as UTF-8
    if (text.includes('�')) bad.push(`${relOf(file)} (replacement char)`);
    // lossless round-trip guarantees the bytes were valid UTF-8
    if (Buffer.from(text, 'utf8').length !== buf.length) bad.push(`${relOf(file)} (roundtrip mismatch)`);
  }
  expect(bad).toEqual([]);
});

// BK-DATA-026
test('BK-DATA-026 markdown link syntax is closed (no dangling link markers)', () => {
  const dangling: string[] = [];
  const fullLink = /!?\[[^\]]*\]\([^)]*\)/g;
  for (const file of allMarkdown()) {
    const stripped = stripFences(readText(relOf(file)));
    stripped.split('\n').forEach((line, i) => {
      const remainder = line.replace(fullLink, '');
      // a leftover `](` means an unterminated link target
      if (remainder.includes('](')) dangling.push(`${relOf(file)}:${i + 1}`);
    });
  }
  expect(dangling).toEqual([]);
});

// BK-DATA-027
test('BK-DATA-027 code fences are balanced (even count per file)', () => {
  const odd: string[] = [];
  for (const file of allMarkdown()) {
    const fences = (readText(relOf(file)).match(/^\s*```/gm) || []).length;
    if (fences % 2 !== 0) odd.push(`${relOf(file)} (fences=${fences})`);
  }
  expect(odd).toEqual([]);
});

// BK-DATA-028 — style/warning level: LF-only, no CRLF
test('BK-DATA-028 no CRLF line endings (consistent LF)', () => {
  const crlf: string[] = [];
  for (const file of allMarkdown()) {
    if (readFileSync(file).includes(Buffer.from('\r\n'))) crlf.push(relOf(file));
  }
  expect(crlf).toEqual([]);
});
