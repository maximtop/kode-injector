/**
 * @file
 */

import { defineConfig } from '@playwright/test';

const DEFAULT_HEADLESS = true;

export default defineConfig({
    testDir: import.meta.dirname,
    testMatch: '**/*.e2e.ts',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    workers: 1,
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    outputDir: '../../test-results/e2e',
    reporter: 'line',
    use: {
        headless: DEFAULT_HEADLESS,
        trace: 'retain-on-failure',
    },
});
