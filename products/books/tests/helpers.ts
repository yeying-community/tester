/**
 * books — shared filesystem helpers for the on-disk documentation repo.
 *
 * books has NO live service: every case is validated against the repo at
 * BOOKS_REPO_PATH (default /Users/liuxin2/Workspace/opensource/books).
 * These helpers mirror the conventions in `summary.spec.ts` (repoPath/readText)
 * and add small markdown-parsing utilities shared by the data specs.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

export function repoPath(): string {
  return process.env['BOOKS_REPO_PATH']?.trim() || '/Users/liuxin2/Workspace/opensource/books';
}

export function abs(rel: string): string {
  return resolve(repoPath(), rel);
}

export function readText(rel: string): string {
  const file = abs(rel);
  if (!existsSync(file)) {
    throw new Error(`books file not found at ${file}`);
  }
  return readFileSync(file, 'utf8');
}

/** Recursively list absolute paths of every file under `dir`, skipping .git. */
export function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

/** Every `.md` file in the repo, as absolute paths. */
export function allMarkdown(): string[] {
  return walk(repoPath()).filter((f) => f.endsWith('.md'));
}

/** Blank out fenced code blocks so their contents don't match link/anchor regexes. */
export function stripFences(text: string): string {
  const lines = text.split('\n');
  let inFence = false;
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push('');
      continue;
    }
    out.push(inFence ? '' : line);
  }
  return out.join('\n');
}

export interface MdLink {
  text: string;
  url: string;
}

/** All `[text](url)` links (code fences stripped, images excluded). */
export function parseLinks(text: string): MdLink[] {
  const stripped = stripFences(text);
  const re = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
  const out: MdLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    if (m[1] === '!') continue; // image, not a link
    out.push({ text: m[2], url: m[3].trim() });
  }
  return out;
}

export interface MdImage {
  alt: string;
  src: string;
}

/** All `![alt](src)` image references (code fences stripped). */
export function parseImages(text: string): MdImage[] {
  const stripped = stripFences(text);
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const out: MdImage[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    out.push({ alt: m[1], src: m[2].trim() });
  }
  return out;
}

/** All ATX headings (`#`..`######`) with fences stripped. */
export function headings(text: string): string[] {
  const stripped = stripFences(text);
  const out: string[] = [];
  for (const line of stripped.split('\n')) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push(m[2].replace(/#+\s*$/, '').trim());
  }
  return out;
}

/** GitHub/mdbook-style anchor slug (keeps CJK, drops punctuation, spaces->'-'). */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿\- ]/g, '')
    .replace(/\s+/g, '-');
}

/** Slug set for a file's headings, applying GitHub's `-1`/`-2` de-dup suffixes. */
export function anchorSet(text: string): Set<string> {
  const seen: Record<string, number> = {};
  const set = new Set<string>();
  for (const h of headings(text)) {
    const base = slug(h);
    if (seen[base] != null) {
      seen[base] += 1;
      set.add(`${base}-${seen[base]}`);
    } else {
      seen[base] = 0;
      set.add(base);
    }
  }
  return set;
}

/** True if `url` targets a repo-internal path (not http(s)/mailto/pure-anchor). */
export function isInternalLink(url: string): boolean {
  return !/^(https?:|mailto:|#)/.test(url);
}
