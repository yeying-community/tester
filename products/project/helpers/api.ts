/**
 * project (YeYing / DooTask) API helpers.
 *
 * DooTask is a Laravel/LaravelS backend. Every API response is the unified
 * envelope `{ ret, msg, data }`:
 *   - ret =  1  success
 *   - ret =  0  business error
 *   - ret = -1  not logged in / identity invalid
 *
 * Auth token is returned in `data.token` on login/register and is replayed on
 * subsequent requests via the `token` request header (DooTask also accepts
 * `dootask-token`).
 *
 * Because the shared admin account (PROJECT_ADMIN_EMAIL) is captcha-locked
 * (DooTask sets a *forever* `code::<email>` cache flag after any failed login,
 * cleared only by a successful login with a valid captcha — which we cannot
 * OCR), the reliable way to obtain a fully authenticated session is to
 * register a throwaway account: registration is open (`reg=open`) and email
 * verification is off, so `type=reg` signs a usable token immediately and the
 * account is NOT captcha-locked.
 *
 * Env vars consumed (indirectly, via callers):
 *   - PROJECT_BASE_URL   base URL of the live service (e.g. http://localhost:2222)
 */
import { request, type APIRequestContext, expect } from '@playwright/test';

export interface Envelope<T = any> {
  ret: number;
  msg: string;
  data: T;
}

/** Build a request context that carries the DooTask auth token header. */
export async function projectApi(
  baseURL: string,
  token?: string,
  extraHeaders: Record<string, string> = {},
): Promise<APIRequestContext> {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      ...(token ? { token } : {}),
      ...extraHeaders,
    },
  });
}

async function jsonOf<T = any>(res: { json(): Promise<any> }): Promise<Envelope<T>> {
  return (await res.json()) as Envelope<T>;
}

/**
 * DooTask writes new dialog memberships into a single shared table
 * (pre_web_socket_dialog_users); concurrent workers routinely trip a MySQL
 * deadlock there. A deadlocked statement is rolled back, so retrying an
 * idempotent call (membership sync, exit, join, task move, …) is safe.
 * Retries only while the envelope reports a deadlock/serialization failure.
 */
export async function withDeadlockRetry<T extends Envelope>(fn: () => Promise<T>): Promise<T> {
  let body = await fn();
  for (let attempt = 0; attempt < 15 && body.ret !== 1 && /deadlock|serialization/i.test(body.msg ?? ''); attempt++) {
    await new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 380)));
    body = await fn();
  }
  return body;
}

export interface RegisteredUser {
  token: string;
  userid: number;
  email: string;
  password: string;
  user: any;
}

/**
 * Register a fresh throwaway account and return its token + identity.
 * Registration directly issues a token (reg_verify is off in this deployment).
 */
export async function registerUser(baseURL: string, password = 'Test123456'): Promise<RegisteredUser> {
  // Registration auto-creates a personal project + dialog; running several in
  // parallel reliably trips a MySQL deadlock on the shared notification dialog
  // (pre_web_socket_dialog_users, dialog_id=20). It is purely transient, so retry
  // generously with jittered backoff and a fresh email each attempt.
  let lastMsg = '';
  for (let attempt = 0; attempt < 15; attempt++) {
    // DooTask caps the email at 32 chars on registration, so keep it short.
    // `e2e_` (4) + local part + `@e2e.local` (10) must stay <= 32.
    const uniq = (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 16);
    const email = `e2e_${uniq}@e2e.local`;
    const ctx = await projectApi(baseURL);
    try {
      const res = await ctx.post('/api/users/login', {
        data: { type: 'reg', email, password },
      });
      const body = await jsonOf(res);
      if (body.ret === 1 && body.data?.token) {
        return {
          token: body.data.token,
          userid: Number(body.data.userid),
          email,
          password,
          user: body.data,
        };
      }
      lastMsg = `ret=${body.ret} msg=${body.msg}`;
      // Only retry on transient DB contention; fail fast on real rejections.
      if (!/deadlock|serialization/i.test(body.msg ?? '')) {
        throw new Error(`registration failed: ${lastMsg}`);
      }
    } finally {
      await ctx.dispose();
    }
    await new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 380)));
  }
  throw new Error(`registration failed after retries: ${lastMsg}`);
}

/** Email + password login. Returns the raw envelope (caller asserts). */
export async function loginPassword(
  baseURL: string,
  email: string,
  password: string,
  extra: Record<string, unknown> = {},
): Promise<Envelope> {
  const ctx = await projectApi(baseURL);
  try {
    const res = await ctx.post('/api/users/login', { data: { email, password, ...extra } });
    return await jsonOf(res);
  } finally {
    await ctx.dispose();
  }
}

/** GET a JSON envelope with an optional token. */
export async function apiGet<T = any>(
  baseURL: string,
  path: string,
  token?: string,
  extraHeaders: Record<string, string> = {},
): Promise<Envelope<T>> {
  const ctx = await projectApi(baseURL, token, extraHeaders);
  try {
    return await jsonOf<T>(await ctx.get(path));
  } finally {
    await ctx.dispose();
  }
}

/** POST a JSON envelope with an optional token. */
export async function apiPost<T = any>(
  baseURL: string,
  path: string,
  data: Record<string, unknown>,
  token?: string,
  extraHeaders: Record<string, string> = {},
): Promise<Envelope<T>> {
  const ctx = await projectApi(baseURL, token, extraHeaders);
  try {
    return await jsonOf<T>(await ctx.post(path, { data }));
  } finally {
    await ctx.dispose();
  }
}

/** Create a project and return its id (asserts success). */
export async function createProject(
  baseURL: string,
  token: string,
  opts: { name?: string; flow?: 'open' | 'close' } = {},
): Promise<{ id: number; data: any }> {
  const name = opts.name ?? `E2E项目${Date.now() % 100000}`;
  const body = await withDeadlockRetry(() =>
    apiPost(baseURL, '/api/project/add', { name, ...(opts.flow ? { flow: opts.flow } : {}) }, token),
  );
  expect(body.ret, `project/add failed: ${body.msg}`).toBe(1);
  return { id: Number(body.data.id), data: body.data };
}

/** Return the first column id of a project. */
export async function firstColumnId(baseURL: string, token: string, projectId: number): Promise<number> {
  const body = await apiGet(baseURL, `/api/project/column/lists?project_id=${projectId}`, token);
  expect(body.ret, `column/lists failed: ${body.msg}`).toBe(1);
  const cols = body.data?.data ?? [];
  expect(cols.length, 'project has no columns').toBeGreaterThan(0);
  return Number(cols[0].id);
}

/** Add a task (optionally owned by ownerId so it can be completed). */
export async function addTask(
  baseURL: string,
  token: string,
  args: { projectId: number; columnId: number; name: string; ownerId?: number },
): Promise<{ id: number; data: any }> {
  const data: Record<string, unknown> = {
    project_id: args.projectId,
    column_id: args.columnId,
    name: args.name,
  };
  if (args.ownerId) data.owner = [args.ownerId];
  const body = await withDeadlockRetry(() => apiPost(baseURL, '/api/project/task/add', data, token));
  expect(body.ret, `task/add failed: ${body.msg}`).toBe(1);
  return { id: Number(body.data.id), data: body.data };
}

/** Set the full member list of a project (must include the owner). */
export async function setProjectMembers(
  baseURL: string,
  ownerToken: string,
  projectId: number,
  userids: number[],
): Promise<void> {
  const body = await withDeadlockRetry(() =>
    apiPost(baseURL, '/api/project/user', { project_id: projectId, userid: userids }, ownerToken),
  );
  expect(body.ret, `project/user failed: ${body.msg}`).toBe(1);
}
