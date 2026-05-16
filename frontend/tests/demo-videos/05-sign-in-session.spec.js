/**
 * Recording: login with a disposable account (registered via API first).
 * Output: docs/demo-videos/05-sign-in-session.mp4
 *
 * Writes to production: creates one user row when run against ecommerce.harshildex.com.
 */
const { test, expect } = require('@playwright/test');
const { ensureApiReady, registerUserViaApi } = require('../e2e-helpers');

const breathe = async (page, ms = 950) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('05 sign in session (demo recording)', async ({ page, request }) => {
    const runId =
      typeof process.env.DEMO_RECORD_RUN_ID === 'string'
        ? process.env.DEMO_RECORD_RUN_ID
        : String(Date.now());
    const email = `video-signin-${runId}@example.com`;
    const password = 'VideoDemo88!';
    const name = 'Video Sign-In Demo';

    await registerUserViaApi(request, { name, email, password });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible({
      timeout: 30_000,
    });
    await breathe(page);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await breathe(page);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name })).toBeVisible({ timeout: 15_000 });
    await breathe(page);
  });
});
