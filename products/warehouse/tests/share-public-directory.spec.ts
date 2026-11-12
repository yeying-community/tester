/**
 * Warehouse — anonymous public directory sharing (WH-API-078).
 *
 * Creates a directory tree through authenticated WebDAV, publishes a directory
 * link, then exercises anonymous listing, nested browsing, file download,
 * traversal rejection, and revocation in API and browser flows.
 *
 * Requires WAREHOUSE_WEBDAV_URL and one working warehouse credential. The
 * browser opens the Warehouse UI on its configured local/test base URL.
 */
import { localizedTitle } from '../../../shared/title';
import { test, expect, envFor } from '../fixtures';
import { acquireToken, authedRequest } from '../helpers/auth';
import { apiContext } from '../../../shared/api';
import { createPublicShare, revokePublicShare } from '../helpers/share';

function apiBase(): string | undefined {
  return envFor('warehouse')['WAREHOUSE_WEBDAV_URL'];
}

function prefix(): string {
  return envFor('warehouse')['WAREHOUSE_WEBDAV_PREFIX'] ?? '/dav';
}

function hasCredential(): boolean {
  const env = envFor('warehouse');
  return Boolean(
    env['WAREHOUSE_AUTH_TOKEN'] ||
    (env['WAREHOUSE_USER'] && env['WAREHOUSE_PASS']) ||
    env['WAREHOUSE_WALLET_PRIVATE_KEY'],
  );
}

test(
  localizedTitle(
    '【公开分享 / E2E】WH-API-078 匿名浏览和下载目录分享',
    'WH-API-078 anonymous visitors browse and download a directory share',
  ),
  async ({ page }) => {
    test.skip(!apiBase(), 'WAREHOUSE_WEBDAV_URL not configured');
    test.skip(!hasCredential(), 'no warehouse credential configured');

    const base = apiBase()!;
    const stamp = Date.now();
    const dirName = `e2e-public-directory-${stamp}`;
    const nestedName = 'nested';
    const fileName = `guide-${stamp}.txt`;
    const content = `public-directory-content-${stamp}`;
    const rootPath = `/${dirName}`;
    const nestedPath = `${rootPath}/${nestedName}`;
    const ownerToken = (await acquireToken(base)).token;
    const owner = await authedRequest(base, ownerToken);
    let shareToken = '';

    try {
      const root = await owner.fetch(`${prefix()}${rootPath}`, { method: 'MKCOL' });
      expect(root.status()).toBe(201);
      const nested = await owner.fetch(`${prefix()}${nestedPath}`, { method: 'MKCOL' });
      expect(nested.status()).toBe(201);
      const upload = await owner.fetch(`${prefix()}${nestedPath}/${fileName}`, {
        method: 'PUT',
        data: content,
      });
      expect([201, 204]).toContain(upload.status());

      const share = await createPublicShare(base, ownerToken, rootPath);
      shareToken = share.token;
      expect(share.isDir).toBe(true);
      expect(share.url).toContain(`/share/${share.token}`);

      const anonymous = await apiContext(base);
      try {
        const listing = await anonymous.get(
          `/api/v1/public/share/directory/${share.token}/entries`,
        );
        expect(listing.status()).toBe(200);
        const rootEntries = (await listing.json()) as {
          entries: Array<{ name: string; isDir: boolean }>;
        };
        expect(rootEntries.entries).toContainEqual(
          expect.objectContaining({ name: nestedName, isDir: true }),
        );

        const nestedListing = await anonymous.get(
          `/api/v1/public/share/directory/${share.token}/entries?path=nested`,
        );
        expect(nestedListing.status()).toBe(200);
        const nestedEntries = (await nestedListing.json()) as {
          entries: Array<{ name: string; isDir: boolean }>;
        };
        expect(nestedEntries.entries).toContainEqual(
          expect.objectContaining({ name: fileName, isDir: false }),
        );

        const traversal = await anonymous.get(
          `/api/v1/public/share/directory/${share.token}/download?path=${encodeURIComponent('../outside.txt')}`,
        );
        expect(traversal.status()).toBe(404);
      } finally {
        await anonymous.dispose();
      }

      await page.goto(`/share/${share.token}`);
      await expect(page.getByRole('heading', { name: dirName })).toBeVisible();
      await page.getByRole('button', { name: nestedName, exact: true }).click();
      await expect(page.getByText(fileName, { exact: true })).toBeVisible();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('link', { name: `下载 ${fileName}` }).click(),
      ]);
      expect(download.suggestedFilename()).toBe(fileName);

      await revokePublicShare(base, ownerToken, share.token);
      shareToken = '';
      const revokedContext = await apiContext(base);
      try {
        const revoked = await revokedContext.get(
          `/api/v1/public/share/directory/${share.token}/entries`,
        );
        expect(revoked.status()).toBe(404);
      } finally {
        await revokedContext.dispose();
      }
    } finally {
      if (shareToken) await revokePublicShare(base, ownerToken, shareToken).catch(() => undefined);
      await owner.fetch(`${prefix()}${rootPath}`, { method: 'DELETE' }).catch(() => undefined);
      await owner.dispose();
    }
  },
);
