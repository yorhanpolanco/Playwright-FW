import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { Utilidades } from './src/utilidades/playwright-utilidades';

const env = process.env.ENV || 'dev';
dotenv.config({ path: `.env.${env}` });

const testDir = './src/test/specs';

export default defineConfig({
  testDir,
  timeout: 60 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI
    ? 2
    : parseInt(process.env.WORKERS ?? '1'),
  reporter: [
    ['html',   { outputFolder: `reports/playwright-report/${process.env.Report}` }],
    ['junit',  { outputFile:   `reports/temp/xml/results.xml`  }],
    ['json',   { outputFile:   `reports/temp/json/results.json` }],
    ['./src/config/CustomReporter.ts']
  ],
  use: {
    launchOptions: {
      logger: {
        isEnabled: (name, severity) => severity !== 'verbose',
        log: async (_name, severity, message) => {
          await Utilidades.agregarLineaAlLog(`${severity}: ${message}`);
        }
      }
    },
    trace:              'retain-on-failure',
    screenshot:         'on',
    video:              'on',
    headless:           process.env.HEADLESS === 'true',
    ignoreHTTPSErrors:  true,
    viewport:           { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*API.*\.spec\.ts/,
      use: {
        trace:      'off',
        video:      'off',
        screenshot: 'off'
      }
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
});
