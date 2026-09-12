import type { Reporter, FullConfig, FullResult, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { PRODUCT_NAMES } from '../types';

interface ProjectStats {
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  timedOut: number;
}

const stats: Record<string, ProjectStats> = Object.fromEntries(
  PRODUCT_NAMES.map((p) => [
    p,
    { passed: 0, failed: 0, skipped: 0, flaky: 0, timedOut: 0 },
  ]),
);

class SummaryReporter implements Reporter {
  onBegin(_config: FullConfig, _suite: Suite): void {
    for (const p of PRODUCT_NAMES) {
      stats[p] = { passed: 0, failed: 0, skipped: 0, flaky: 0, timedOut: 0 };
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? 'unknown';
    const bucket = stats[project] ?? (stats[project] = { passed: 0, failed: 0, skipped: 0, flaky: 0, timedOut: 0 });
    if (result.status === 'passed') bucket.passed += 1;
    else if (result.status === 'failed') bucket.failed += 1;
    else if (result.status === 'skipped') bucket.skipped += 1;
    else if (result.status === 'timedOut') bucket.timedOut += 1;
    if (result.status === 'passed' && result.retry > 0) bucket.flaky += 1;
  }

  onEnd(_result: FullResult): void {
    // eslint-disable-next-line no-console
    console.log('\n┌──────────── per-project summary ────────────┐');
    // eslint-disable-next-line no-console
    console.log('│ product     │ pass │ fail │ skip │ flaky │ to │');
    // eslint-disable-next-line no-console
    console.log('├─────────────┼──────┼──────┼──────┼───────┼────┤');
    for (const p of PRODUCT_NAMES) {
      const s = stats[p];
      if (!s) continue;
      // eslint-disable-next-line no-console
      console.log(
        `│ ${p.padEnd(11)} │ ${String(s.passed).padStart(4)} │ ${String(s.failed).padStart(4)} │ ${String(s.skipped).padStart(4)} │ ${String(s.flaky).padStart(5)} │ ${String(s.timedOut).padStart(2)} │`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('└─────────────┴──────┴──────┴──────┴───────┴────┘');
  }
}

export default SummaryReporter;
