/**
 * Recording: homepage search → results list → open first result.
 * Output: docs/demo-videos/04-search-catalog.webm
 */
const { test, expect } = require('@playwright/test');
const { ensureApiReady } = require('../e2e-helpers');

const breathe = async (page, ms = 550) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('04 search catalog (demo recording)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /Tailored by Boutique/i })
    ).toBeVisible({ timeout: 30_000 });
    await breathe(page);

    await page.locator('#header-search-q').fill('torrid');
    await breathe(page, 350);
    await page.getByRole('button', { name: 'Submit product search' }).click();

    await expect(page).toHaveURL(/\/products\/search\//);
    await expect(page.getByRole('heading', { name: 'Latest Products' })).toBeVisible({
      timeout: 30_000,
    });
    await breathe(page);

    const listing = page.locator('main a[href^="/products/"]').first();
    await expect(listing).toBeVisible({ timeout: 30_000 });
    await listing.click();
    await expect(page.getByRole('button', { name: /Add to Cart|Out of Stock/ })).toBeVisible({
      timeout: 30_000,
    });
    await breathe(page);
  });
});
