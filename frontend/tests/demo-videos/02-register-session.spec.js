/**
 * Recording: shopper registration and session in header.
 * Output: docs/demo-videos/02-register-session.webm
 */
const { test, expect } = require('@playwright/test');
const { ensureApiReady } = require('../e2e-helpers');
const { demoVideoPath } = require('./_outputPath');

const breathe = async (page, ms = 550) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('02 register session (demo recording)', async ({ page }) => {
    const runId = process.env.GITHUB_RUN_ID || String(Date.now());
    const email = `demo-register-${runId}@example.com`;
    const password = 'DemoPass88';
    const name = 'Demo Shopper';

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
    await breathe(page);

    await page.locator('#name').fill(name);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await breathe(page);

    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.locator('#username')).toContainText(name);
    await breathe(page);

    const clip = page.video();
    if (clip) await clip.saveAs(demoVideoPath('02-register-session'));
  });
});
