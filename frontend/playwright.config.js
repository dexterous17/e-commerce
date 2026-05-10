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
      timeout: Math.max(
        Number(process.env.DEMO_VIDEO_TEST_TIMEOUT_MS || 480_000),
        120_000
      ),
      testMatch: '**/demo-videos/*.spec.js',
      use: {
        video: {
          mode: 'on',
          // Smaller footprint = faster finalize than 1280×720
          size: { width: 960, height: 540 },
        },
        launchOptions: {
          slowMo: Number(process.env.DEMO_SLOW_MO || 0),
        },
      },
      workers: 1,
      fullyParallel: false,
    },
  ],
  ...(webServer ? { webServer } : {}),
});
