import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PRODUCT_NAMES, type ProductName, baseURLKey as _baseURLKey } from './types';

// Re-export so scripts/ can use it without importing types.ts.
export const baseURLKey = _baseURLKey;

// Load .env from the tester root if present. Missing file is fine; CI sets vars directly.
try {
  loadDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });
} catch {
  // ignore
}

/**
 * Per-product env contract. Only the base URL is required for most products; the
 * other keys are optional and consumed only by specific specs.
 */
export interface ProductEnv {
  name: ProductName;
  baseURL: string | undefined;
  apiURL?: string;
  authToken?: string;
  [extra: string]: string | undefined;
}

const EXTRA_KEYS: Record<ProductName, string[]> = {
  warehouse: [
    'WAREHOUSE_ADMIN_URL',
    'WAREHOUSE_WEBDAV_URL',
    'WAREHOUSE_WEBDAV_PREFIX',
    'WAREHOUSE_USER',
    'WAREHOUSE_PASS',
    'WAREHOUSE_AUTH_TOKEN',
    'WAREHOUSE_WALLET_PRIVATE_KEY',
    'WAREHOUSE_EXPECTED_ADDRESS',
  ],
  node: ['NODE_API_URL', 'NODE_WALLET_PRIVATE_KEY', 'NODE_EXPECTED_ADDRESS'],
  router: ['ROUTER_WALLET_PRIVATE_KEY', 'ROUTER_EXPECTED_ADDRESS'],
  chat: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
  social: ['SOCIAL_USER', 'SOCIAL_PASS'],
  project: ['APP_DEV_PORT', 'PROJECT_USER', 'PROJECT_PASS'],
  knowledge: ['KNOWLEDGE_API_URL'],
  marketplace: ['MARKETPLACE_BASE_URL', 'MARKETPLACE_REPO_PATH'],
  books: ['BOOKS_BASE_URL', 'BOOKS_REPO_PATH'],
  agent: ['AGENT_API_URL', 'AGENT_PRIVATE_KEY'],
};

/** Return the base URL for a product, or undefined if not configured. */
export function baseURLFor(product: ProductName): string | undefined {
  return process.env[baseURLKey(product)]?.trim() || undefined;
}

export function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`Required environment variable "${name}" is not set.`);
  }
  return v;
}

/** Load all known env values for a product into a structured object. */
export function envFor(product: ProductName): ProductEnv {
  const env: ProductEnv = {
    name: product,
    baseURL: baseURLFor(product),
  };
  for (const key of EXTRA_KEYS[product]) {
    env[key] = process.env[key];
  }
  return env;
}

/** Snapshot the env for a single product, or for all if `product` is omitted. */
export function loadEnv(product?: ProductName): ProductEnv | Record<ProductName, ProductEnv> {
  if (product) {
    return envFor(product);
  }
  return Object.fromEntries(PRODUCT_NAMES.map((p) => [p, envFor(p)])) as Record<
    ProductName,
    ProductEnv
  >;
}

/**
 * Try to read a value from `process.env` first, then from a `.env` file at the
 * given path. Used by scripts/check-env.ts to detect misconfigured variables
 * even when dotenv hasn't been loaded yet.
 */
export function readEnvFile(path: string, key: string): string | undefined {
  try {
    const raw = readFileSync(path, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] === key) {
        const value = m[2] ?? '';
        const trimmed = value.trim();
        if (
          (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      }
    }
  } catch {
    // file missing or unreadable
  }
  return undefined;
}
