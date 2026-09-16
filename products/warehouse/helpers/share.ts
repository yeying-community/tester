/**
 * Warehouse share helpers — public shares and directed (user) shares.
 *
 * All calls go against the JSON API which the backend serves on the WebDAV
 * port (6065, `WAREHOUSE_WEBDAV_URL`). The share create/access endpoints are
 * NOT wrapped in the standard {code,message,data} envelope — they return the
 * item object at the top level (see warehouse share.go writeShareCreateResponse).
 *
 * Verified contract facts (source: warehouse internal/.../handler/share.go,
 * share_user.go, share_expiry.go, domain/share/share.go):
 *   - share mode:   "download" | "preview"  (default "download")
 *   - expiresUnit:  minute|hour|day|week|month|year  (singular)
 *   - public create → { token, name, path, mode, url, viewCount, downloadCount, expiresAt? }
 *   - GET /api/v1/public/share/<token>            → 302 → url (with filename)
 *   - GET /api/v1/public/share/<token>/<filename> → 200 file bytes
 *   - directed create → { id, name, path, isDir, permissions, targetType, ... }
 */
import { request, type APIRequestContext } from '@playwright/test';

export interface PublicShare {
  token: string;
  name: string;
  path: string;
  mode: string;
  url: string;
  viewCount: number;
  downloadCount: number;
  expiresAt?: string;
}

export interface DirectedShare {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  permissions: string[];
  targetType: string;
  targetCount: number;
  audienceCount: number;
  allUsers: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface ShareExpiry {
  expiresValue?: number;
  expiresUnit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
}

async function bearerContext(apiBase: string, token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * PUT a small text file to the owner's WebDAV root via Bearer auth. Returns the
 * share-relative path ("/<name>"). The file becomes a shareable resource.
 */
export async function putOwnedFile(
  apiBase: string,
  token: string,
  name: string,
  content: string,
): Promise<string> {
  const ctx = await bearerContext(apiBase, token);
  try {
    const res = await ctx.fetch(`/dav/${name}`, { method: 'PUT', data: content });
    if (res.status() !== 201 && res.status() !== 204) {
      throw new Error(`PUT /dav/${name} failed: ${res.status()} ${await res.text()}`);
    }
    return `/${name}`;
  } finally {
    await ctx.dispose();
  }
}

export async function createPublicShare(
  apiBase: string,
  token: string,
  path: string,
  opts: { mode?: 'download' | 'preview' } & ShareExpiry = {},
): Promise<PublicShare> {
  const ctx = await bearerContext(apiBase, token);
  try {
    const res = await ctx.post('/api/v1/public/share/create', {
      data: {
        path,
        mode: opts.mode ?? 'download',
        expiresValue: opts.expiresValue ?? 1,
        expiresUnit: opts.expiresUnit ?? 'day',
      },
    });
    if (res.status() !== 200) {
      throw new Error(`share create failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as PublicShare;
  } finally {
    await ctx.dispose();
  }
}

export async function revokePublicShare(
  apiBase: string,
  token: string,
  shareToken: string,
): Promise<void> {
  const ctx = await bearerContext(apiBase, token);
  try {
    await ctx.post('/api/v1/public/share/revoke', { data: { token: shareToken } });
  } finally {
    await ctx.dispose();
  }
}

export async function createDirectedShare(
  apiBase: string,
  token: string,
  opts: {
    path: string;
    targetAddresses: string[];
    permissions: string[];
    targetMode?: 'addresses' | 'groups' | 'all_users';
  } & ShareExpiry,
): Promise<DirectedShare> {
  const ctx = await bearerContext(apiBase, token);
  try {
    const res = await ctx.post('/api/v1/public/share/user/create', {
      data: {
        path: opts.path,
        targetMode: opts.targetMode ?? 'addresses',
        targetAddresses: opts.targetAddresses,
        permissions: opts.permissions,
        expiresValue: opts.expiresValue ?? 1,
        expiresUnit: opts.expiresUnit ?? 'day',
      },
    });
    if (res.status() !== 200) {
      throw new Error(`directed share create failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as DirectedShare;
  } finally {
    await ctx.dispose();
  }
}

export async function revokeDirectedShare(
  apiBase: string,
  token: string,
  id: string,
): Promise<void> {
  const ctx = await bearerContext(apiBase, token);
  try {
    await ctx.post('/api/v1/public/share/user/revoke', { data: { id } });
  } finally {
    await ctx.dispose();
  }
}
