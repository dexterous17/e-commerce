/**
 * End-to-end login flow: registers a fresh user via the API, then signs in through the UI.
 *
 * Requires the stack from `npm run dev` in frontend/ (Vite + API). API URL defaults to
 * http://127.0.0.1:5002 (see env/frontend/.env DEV_PROXY_TARGET). Postgres must be available
 * for the backend (DATABASE_URL / backend/db/.env). Install browsers once: npm run test:e2e:install
 *
 * If port 5173 is already taken by Vite without the API, either stop that process or run with
 * PW_REUSE_SERVER=0 so Playwright starts `npm run dev` itself (see frontend/playwright.config.js).
 *
 * Run: npm run test:e2e -- tests/login.e2e.spec.js
 */

const { test, expect } = require('@playwright/test');
const { ensureApiReady, getApiOrigin } = require('./e2e-helpers');

const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const testEmail = `e2e-login-${runId}@example.com`;
const testPassword = 'e2ePass99';
const testName = 'E2E Login User';

test.describe('Login', () => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);

    const res = await request.post(`${getApiOrigin()}/api/users`, {
      data: {
        name: testName,
        email: testEmail,
        password: testPassword,
      },
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`Test setup: register failed ${res.status()}: ${body}`);
    }
  });

  test('successful login redirects and shows the signed-in user in the header', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.locator('#username')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#username')).toContainText(testName);

    const stored = await page.evaluate(() => localStorage.getItem('userInfo'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored);
    expect(parsed.email).toBe(testEmail);
    expect(parsed.token).toBeTruthy();
  });

  test('invalid password shows an error on the login form', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill('wrong-password-12345');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
