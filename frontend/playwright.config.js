const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Default: reuse a running dev server for speed. Set PW_REUSE_SERVER=0 so tests always start
    // `npm run dev` (Vite waits for API — avoids Vite-only on 5173 with no backend).
    reuseExistingServer: process.env.PW_REUSE_SERVER !== '0',
    timeout: 120000,
  },
});
