/**
 * Recording: login, add to cart, shipping, payment placeholders, place order, order confirmation.
 * Output: docs/demo-videos/03-checkout-flow.webm
 */
const { test, expect } = require('@playwright/test');
const {
  ensureApiReady,
  registerUserViaApi,
  fetchFirstInStockProduct,
} = require('../e2e-helpers');
const { demoVideoPath } = require('./_outputPath');

const breathe = async (page, ms = 550) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('03 checkout flow (demo recording)', async ({ page, request }) => {
    const product = await fetchFirstInStockProduct(request, { optional: true });
    test.skip(!product, 'Needs at least one in-stock product in the DB.');

    const runId = process.env.GITHUB_RUN_ID || String(Date.now());
    const email = `demo-checkout-${runId}@example.com`;
    const password = 'DemoPass88';
    const name = 'Demo Checkout';

    await registerUserViaApi(request, { name, email, password });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await breathe(page);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await breathe(page);

    await page.goto(`/products/${product._id}`);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page).toHaveURL(/\/cart\/?$/);
    await breathe(page);

    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
    await expect(page).toHaveURL(/\/shipping\/?$/, { timeout: 20_000 });
    await breathe(page);

    await page.locator('#address').fill('123 Demo Lane');
    await page.locator('#city').fill('Demoville');
    await page.locator('#postalCode').fill('12345');
    await page.locator('#country').fill('United States');
    await breathe(page);
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    await expect(page).toHaveURL(/\/payment\/?$/);
    await breathe(page);

    await page.getByRole('button', { name: 'Continue to Place Order' }).click();
    await expect(page).toHaveURL(/\/placeorder\/?$/);
    await breathe(page);

    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Order Items' })).toBeVisible();
    await expect(page.getByRole('link', { name: product.name })).toBeVisible();
    await breathe(page);

    const clip = page.video();
    if (clip) await clip.saveAs(demoVideoPath('03-checkout-flow'));
  });
});
