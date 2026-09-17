/**
 * chat persisted-store reader.
 *
 * The chat app persists all Zustand stores (app-config, skill-store,
 * access-control, ...) through `createJSONStorage(() => indexedDBStorage)`,
 * i.e. into IndexedDB via idb-keyval — NOT localStorage. idb-keyval uses the
 * default database `keyval-store` / object store `keyval`, keyed by the store
 * name (StoreKey). These helpers read that persisted JSON from the page so
 * tests can assert what the app actually saved.
 */
import type { Page } from '../fixtures';

/** Raw JSON string persisted for `key`, or null. */
export async function readPersistedRaw(page: Page, key: string): Promise<string | null> {
  return await page.evaluate(async (k: string) => {
    return await new Promise<string | null>((resolve) => {
      let open: IDBOpenDBRequest;
      try {
        open = indexedDB.open('keyval-store');
      } catch {
        resolve(null);
        return;
      }
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('keyval')) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction('keyval', 'readonly');
          const req = tx.objectStore('keyval').get(k);
          req.onsuccess = () => resolve((req.result as string) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    });
  }, key);
}

/** Parsed `state` object of the persisted store `key`, or null. */
export async function readPersistedState<T = any>(page: Page, key: string): Promise<T | null> {
  const raw = await readPersistedRaw(page, key);
  if (!raw) return null;
  try {
    return (JSON.parse(raw)?.state as T) ?? null;
  } catch {
    return null;
  }
}
