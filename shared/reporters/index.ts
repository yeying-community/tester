import type { ReporterDescription } from '@playwright/test';

const summaryReporterPath = new URL('./summary.ts', import.meta.url).pathname;

export function defaultReporters(): ReporterDescription[] {
  return [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'junit.xml' }],
    [summaryReporterPath],
  ];
}
