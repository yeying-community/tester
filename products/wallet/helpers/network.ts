/**
 * Network stubbing for hermetic wallet tests.
 *
 * The wallet reaches out to a handful of public YeYing endpoints by default
 * (`blockchain.yeying.pub`, `node.yeying.pub`, `webdav.yeying.pub`,
 * `blockscout.yeying.pub`, plus `ethereum-rpc.publicnode.com` for Ethereum).
 * Without stubbing, popup tests that hit the unlock page will stall
 * waiting for the keyring-init balance fetch and timing out.
 *
 * The original wallet repo stubs each host individually
 * (`wallet/tests/e2e/extension-smoke.test.mjs`). Here we use a single
 * `*.yeying.pub` wildcard plus the publicnode Ethereum RPC — covers
 * every default network the wallet ships with.
 *
 * Tests that *want* to hit the real network should not call this helper.
 */
import type { BrowserContext } from '@playwright/test';

/**
 * Abort every request to YeYing public services. The wallet handles the
 * `connectionfailed` error the same way the per-host stub in the smoke
 * test does — it just doesn't show a balance, which is fine for UI tests.
 */
export async function stubPublicEndpoints(context: BrowserContext): Promise<void> {
  await context.route('https://*.yeying.pub/**', (route) => route.abort('connectionfailed'));
  // The wallet's default Ethereum network is publicnode.com. Stub it too
  // unless the spec explicitly wants to talk to mainnet.
  await context.route('https://ethereum-rpc.publicnode.com/**', (route) =>
    route.abort('connectionfailed'),
  );
}