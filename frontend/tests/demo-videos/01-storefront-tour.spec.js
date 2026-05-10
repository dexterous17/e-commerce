/**
 * Recording: browse home, catalog, product detail, add to cart.
 * Output: docs/demo-videos/01-storefront-tour.webm
 */
const { test, expect } = require('@playwright/test');
const { ensureApiReady, fetchFirstInStockProduct } = require('../e2e-helpers');

const breathe = async (page, ms = 650) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('01 storefront tour (demo recording)', async ({ page, request }) => {
    const product = await fetchFirstInStockProduct(request, { optional: true });
    test.skip(!product, 'Needs at least one in-stock product to complete the demo cart step.');

    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /Tailored by Boutique/i })
    ).toBeVisible({ timeout: 30_000 });
    await breathe(page);

    await page.getByRole('link', { name: /Browse Inventory/i }).click();
    await expect(page.getByRole('heading', { name: 'Latest Products' })).toBeVisible({
      timeout: 30_000,
    });
    await breathe(page);

    await page.goto(`/products/${product._id}`);
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({
      timeout: 30_000,
    });
    await breathe(page);

    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page).toHaveURL(/\/cart\/?$/);
    await expect(page.getByRole('link', { name: product.name }).first()).toBeVisible();
    await breathe(page);
  });
});
