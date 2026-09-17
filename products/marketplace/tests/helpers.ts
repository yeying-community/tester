/**
 * Shared read/validate helpers for the marketplace data-validation suite.
 *
 * marketplace has NO live service — every DATA case reads the on-disk repo at
 * MARKETPLACE_REPO_PATH. These helpers mirror the conventions of index.spec.ts
 * (existsSync guard + JSON.parse) and derive schema constraints from the real
 * schemas/*.json files so the assertions track the product's own contract.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

export const KEBAB = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
export const SEMVER = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;

export function repoPath(): string {
  return (
    process.env['MARKETPLACE_REPO_PATH']?.trim() ||
    '/Users/liuxin2/Workspace/opensource/marketplace'
  );
}

export function abs(rel: string): string {
  return resolve(repoPath(), rel);
}

export function exists(rel: string): boolean {
  return existsSync(abs(rel));
}

export function readJson<T = unknown>(rel: string): T {
  const file = abs(rel);
  if (!existsSync(file)) {
    throw new Error(`marketplace ${rel} not found at ${file}`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/** Mirrors index.spec.ts's readIndexJson error message; used by edge cases with a custom root. */
export function readIndexFrom(root: string): unknown[] {
  const file = resolve(root, 'index.json');
  if (!existsSync(file)) {
    throw new Error(`marketplace index.json not found at ${file}`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as unknown[];
}

export interface IndexEntry {
  id: string;
  lang: string;
  version: string;
  name: LocalizedText;
  description?: LocalizedText;
  category?: string;
  tags?: string[];
  path: string;
  release?: { status?: string; review?: string };
}

export type LocalizedText = string | { cn?: string; en?: string };

export interface ToolIndexEntry {
  id: string;
  version: string;
  name: LocalizedText;
  path: string;
  release?: { status?: string; review?: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SkillPackage = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolServerPackage = Record<string, any>;

export function readIndex(): IndexEntry[] {
  return readJson<IndexEntry[]>('index.json');
}

export function readPackages(): { cn?: SkillPackage[]; en?: SkillPackage[] } {
  return readJson('packages.json');
}

/** Flatten packages.json's { cn:[], en:[] } into [{ lang, pkg }] pairs. */
export function allSkillPackages(): { lang: string; pkg: SkillPackage }[] {
  const groups = readPackages();
  const out: { lang: string; pkg: SkillPackage }[] = [];
  for (const lang of ['cn', 'en'] as const) {
    for (const pkg of groups[lang] ?? []) out.push({ lang, pkg });
  }
  return out;
}

export function readToolsIndex(): ToolIndexEntry[] {
  return readJson<ToolIndexEntry[]>('tools/index.json');
}

export function readToolsPackages(): ToolServerPackage[] {
  return readJson<ToolServerPackage[]>('tools/packages.json');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readSkillSchema(): any {
  return readJson('schemas/skill.schema.json');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readToolSchema(): any {
  return readJson('schemas/tool-server.schema.json');
}

/** Matches build.mjs isLocalizedText: string(non-empty) OR object with cn/en string. */
export function isLocalizedText(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  if (value && typeof value === 'object') {
    const v = value as { cn?: unknown; en?: unknown };
    return typeof v.cn === 'string' || typeof v.en === 'string';
  }
  return false;
}

/** Top-level additionalProperties:false check derived from a schema's declared properties. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unknownTopLevelKeys(obj: Record<string, any>, schema: any): string[] {
  const allowed = new Set(Object.keys(schema?.properties ?? {}));
  return Object.keys(obj).filter((k) => !allowed.has(k));
}

/** Parent folder name of an index path, e.g. skills/chat/web-research/cn.json -> web-research. */
export function parentFolder(p: string): string {
  return basename(dirname(p));
}

export function label(pkg: SkillPackage): string {
  return `${pkg.id}/${pkg.lang ?? ''}`;
}
