/**
 * Recording helper for user-manual generation.
 *
 * Tests opt-in by calling `recorder.step(page, label, { note? })` at key
 * interaction points. Each call captures a full-page screenshot and
 * appends to the spec's `steps.json` manifest. When the test finishes
 * (pass or fail), `finalize()` flushes the JSON.
 *
 * Output layout (gitignored):
 *   manual/<product>/<spec-slug>/
 *     01-welcome-page.png
 *     02-set-password.png
 *     ...
 *     steps.json
 *
 * Render with `pnpm manual:build` (scripts/build-manual.ts).
 *
 * Tests that don't call `recorder.step` produce no artifacts — opt-in
 * by design.
 */
import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface StepRecord {
  index: number;
  label: string;
  screenshot: string;
  url?: string;
  note?: string;
}

export interface SpecRecording {
  product: string;
  specName: string;
  specFile: string;
  startedAt: string;
  finishedAt?: string;
  passed?: boolean;
  steps: StepRecord[];
}

/** Root directory for manual artifacts. Relative to tester cwd. */
export function manualRoot(): string {
  return join(process.cwd(), 'manual');
}

/** Slugify a label for filename use. Keeps CJK characters. */
export function slug(s: string, max = 60): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'step';
}

/**
 * Per-spec recorder. Lazily initializes the output directory on the
 * first `step()` call so specs that never record produce no artifacts.
 */
export class Recorder {
  private state: SpecRecording | null = null;
  private dir: string | null = null;

  constructor(
    private readonly product: string,
    private readonly specName: string
  ) {}

  /** True if at least one step has been recorded. */
  get hasSteps(): boolean {
    return !!this.state && this.state.steps.length > 0;
  }

  async step(page: Page, label: string, opts?: { note?: string }): Promise<void> {
    if (!this.state) {
      this.state = {
        product: this.product,
        specName: this.specName,
        specFile: '',
        startedAt: new Date().toISOString(),
        steps: [],
      };
      this.dir = join(manualRoot(), this.product, slug(this.specName));
      await mkdir(this.dir, { recursive: true });
    }
    const idx = String(this.state.steps.length + 1).padStart(2, '0');
    const filename = `${idx}-${slug(label)}.png`;
    // Extension popup and approval windows have an explicit 380x600 contract.
    // `fullPage: true` makes Chromium expand a chrome-extension document to
    // its layout/scroll height (for example 875px when a fixed modal is open),
    // which records the screenshot canvas rather than the actual popup.
    const isWalletExtensionPage = page.url().startsWith('chrome-extension://');
    if (!isWalletExtensionPage) {
      // Most wallet protocol tests use a deliberately empty synthetic dApp.
      // Make the recorded state visible without changing the dApp behaviour.
      await page.evaluate(({ label: stepLabel }) => {
        const body = document.body;
        if (!body) return;
        const existing = body.querySelector<HTMLElement>('[data-manual-recorder-state]');
        if (existing) {
          existing.textContent = stepLabel;
          return;
        }
        if (body.textContent?.trim()) return;
        const state = document.createElement('aside');
        state.dataset.manualRecorderState = 'true';
        state.textContent = stepLabel;
        Object.assign(state.style, {
          position: 'fixed',
          top: '24px',
          left: '24px',
          zIndex: '2147483647',
          padding: '16px 20px',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
          font: '600 16px system-ui, sans-serif',
          pointerEvents: 'none',
        });
        body.appendChild(state);
      }, { label });
    }
    await page.screenshot({
      path: join(this.dir!, filename),
      fullPage: !isWalletExtensionPage,
    });
    this.state.steps.push({
      index: this.state.steps.length + 1,
      label,
      screenshot: filename,
      url: page.url(),
      note: opts?.note,
    });
  }

  /**
   * Flush `steps.json`. Called from the fixture after the test body
   * resolves. No-op when no steps were recorded.
   */
  async finalize(specFile: string, passed: boolean): Promise<StepRecord[] | null> {
    if (!this.state || !this.dir || this.state.steps.length === 0) return null;
    this.state.specFile = specFile;
    this.state.finishedAt = new Date().toISOString();
    this.state.passed = passed;
    await writeFile(join(this.dir, 'steps.json'), JSON.stringify(this.state, null, 2), 'utf8');
    return this.state.steps;
  }
}
