import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

import { Utilidades } from './src/utilidades/playwright-utilidades';

// Load environment from ENV variable or default to 'dev'
const env = process.env.ENV || 'dev';
dotenv.config({ path: `.env.${env}` });

const testDir = './src/test/specs';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir,
  timeout: 60 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: `playwright-report/${process.env.Report}` }],
    ['junit', { outputFile: 'src/test-result/reports/xml/results.xml' }],
    ['json', { outputFile: 'src/test-result/reports/json/results.json' }],
    ['./src/config/CustomReporter.ts']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    launchOptions: {
      logger: {
        isEnabled: () => true,
        log: async (name, severity, message, args, hints) => {
          let valor: string[] = typeof message === 'string' ? message.split(' ') : [];
          if (valor[2] !== 'started') {
            const log = `[W${process.env.TEST_WORKER_INDEX || '?'}] ${severity} message: ${message}`;
            await Utilidades.agregarLineaAlLog(log);
          }
        }
      }
    },
    /* Collect trace, screenshots and video for debugging */
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'on',
    headless: false,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'api',
      testMatch: /.*API.*\.spec\.ts/, // Asegura que solo ejecute tests de la carpeta API
      use: {
        // No necesitamos levantar UI completa, solo contexto de request
        trace: 'off',
        video: 'off',
        screenshot: 'off'
      }
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      },
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
