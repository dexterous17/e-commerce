/**
 * Playwright storefront base URL. Local Vite default; override for CI or prod smoke tests.
 * @see env/frontend/.env.test.example
 */
const DEFAULT_PLAYWRIGHT_BASE_URL = 'http://localhost:5173';

function getPlaywrightStorefrontBaseUrl() {
  const fromEnv =
    process.env.PLAYWRIGHT_BASE_URL || process.env.PW_BASE_URL || '';
  const trimmed = String(fromEnv).trim();
  return trimmed.replace(/\/$/, '') || DEFAULT_PLAYWRIGHT_BASE_URL;
}

module.exports = {
  DEFAULT_PLAYWRIGHT_BASE_URL,
  getPlaywrightStorefrontBaseUrl,
};
