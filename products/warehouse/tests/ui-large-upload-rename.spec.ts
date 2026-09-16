/**
 * warehouse — UI cases that require the frontend dev server (WH-UI-009, WH-UI-012).
 *
 *   - WH-UI-009: 上传大文件显示进度(分片上传) — large-file chunked-upload progress.
 *   - WH-UI-012: 重命名文件/文件夹 — rename a file/folder via the file UI.
 *
 * Both drive the real browser UI served on WAREHOUSE_BASE_URL (5173). That dev
 * server is NOT running in this environment, so these cases are skipped cleanly
 * (never faked). They will run once the frontend is up — the selectors live
 * alongside the other ui-*.spec.ts journeys.
 */
import { test } from '../fixtures';

const REASON = 'warehouse frontend (5173) not running';

test('WH-UI-009 uploading a large file shows chunked-upload progress', async () => {
  test.skip(true, REASON);
});

test('WH-UI-012 rename a file or folder via the file UI', async () => {
  test.skip(true, REASON);
});
