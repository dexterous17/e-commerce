/**
 * Recording: login then open Profile (User Profile / My Orders).
 * Output: docs/demo-videos/06-profile-orders.webm
 *
 * Writes to production when pointed at ecommerce.harshildex.com — creates one disposable user via API first.
 */
const { test, expect } = require('@playwright/test');
const { ensureApiReady, registerUserViaApi } = require('../e2e-helpers');

const breathe = async (page, ms = 550) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('06 profile orders (demo recording)', async ({ page, request }) => {
    const runId =
      typeof process.env.DEMO_RECORD_RUN_ID === 'string'
        ? process.env.DEMO_RECORD_RUN_ID
        : String(Date.now());
    const email = `video-profile-${runId}@example.com`;
    const password = 'VideoDemo88!';
    const name = 'Video Profile Demo';

    await registerUserViaApi(request, { name, email, password });

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await breathe(page);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'User Profile' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
    await breathe(page);
  });
});
