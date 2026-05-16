const { defineConfig } = require('@playwright/test');
const {
  DEFAULT_PLAYWRIGHT_BASE_URL,
  getPlaywrightStorefrontBaseUrl,
} = require('./tests/e2e-constants');

const baseURL = getPlaywrightStorefrontBaseUrl();

const skipWebServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1' ||
  process.env.PW_SKIP_WEBSERVER === '1';

const webServer = skipWebServer
  ? undefined
  : {
      command: 'npm run dev',
      // Must match Vite `server.port` (local dev); not necessarily PLAYWRIGHT_BASE_URL.
      url: DEFAULT_PLAYWRIGHT_BASE_URL,
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
          // ms delay between Playwright ops — higher = slower, clearer demo pacing (override with DEMO_SLOW_MO=0)
          slowMo: Number(process.env.DEMO_SLOW_MO ?? 125),
        },
      },
      workers: 1,
      fullyParallel: false,
    },
  ],
  ...(webServer ? { webServer } : {}),
});
