const { defineConfig } = require('@playwright/test');

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PW_BASE_URL ||
  'http://localhost:5173';

const skipWebServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1' ||
  process.env.PW_SKIP_WEBSERVER === '1';

const webServer = skipWebServer
  ? undefined
  : {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: process.env.PW_REUSE_SERVER !== '0',
      timeout: 240000,
    };

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/demo-videos/**',
    },
    {
      name: 'demo-videos',
      testMatch: '**/demo-videos/*.spec.js',
      use: {
        video: {
          mode: 'on',
          size: { width: 1280, height: 720 },
        },
        launchOptions: {
          slowMo: 140,
        },
      },
      workers: 1,
      fullyParallel: false,
    },
  ],
  ...(webServer ? { webServer } : {}),
});
