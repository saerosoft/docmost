import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const runtimeDirectory = resolve('.tmp/browser-runtime');
mkdirSync(runtimeDirectory, { recursive: true });
process.env.TMPDIR = runtimeDirectory;
process.env.TEMP = runtimeDirectory;
process.env.TMP = runtimeDirectory;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '.tmp/playwright-results',
  reporter: [['list'], ['json', { outputFile: '.tmp/playwright-results.json' }]],
  use: {
    baseURL: 'http://localhost:9090',
    browserName: 'chromium',
    channel: process.env.NOTE_GUI_E2E_CHANNEL,
    headless: true,
    actionTimeout: 15_000,
    storageState: process.env.NOTE_GUI_E2E_STORAGE_STATE,
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
