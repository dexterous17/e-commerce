/**
 * Recording: login → cart → shipping → payment method → place order → confirm payment (API
 * simulate when backend allows PAYPAL_SKIP_VERIFY) → reload order page → Profile / My Orders table.
 *
 * Output: docs/demo-videos/06-profile-orders.webm
 *
 * Paid step: completes via `payOrderViaApiForDemo` (no PayPal iframe). Backend must skip PayPal
 * verification: NODE_ENV≠production, PAYPAL_SKIP_VERIFY=true, no PAYPAL_CLIENT_SECRET (see env/backend/.env.example).
 *
 * Writes to production when pointed at ecommerce.harshildex.com — creates one disposable user via API first.
 */
const { test, expect } = require('@playwright/test');
const {
  ensureApiReady,
  registerUserViaApi,
  fetchFirstInStockProduct,
  payOrderViaApiForDemo,
} = require('../e2e-helpers');

const breathe = async (page, ms = 950) => {
  await page.waitForTimeout(ms);
};

test.describe(() => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('06 profile orders (demo recording)', async ({ page, request }) => {
    const product = await fetchFirstInStockProduct(request, { optional: true });
    test.skip(!product, 'Needs at least one in-stock product in the DB.');

    const runId =
      typeof process.env.DEMO_RECORD_RUN_ID === 'string'
        ? process.env.DEMO_RECORD_RUN_ID
        : String(Date.now());
    const email = `video-profile-${runId}@example.com`;
    const password = 'VideoDemo88!';
    const name = 'Video Profile Demo';

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
    await expect(page.getByRole('heading', { name: 'Payment Method' })).toBeVisible();
    await breathe(page);

    await page.getByRole('button', { name: 'Continue to Place Order' }).click();
    await expect(page).toHaveURL(/\/placeorder\/?$/);
    await breathe(page);

    await page.locator('.place-order-screen').getByRole('button', { name: 'Place Order' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+/, { timeout: 180_000 });
    await expect(page.getByRole('heading', { name: 'Order Items' })).toBeVisible();
    await expect(page.getByRole('link', { name: product.name }).first()).toBeVisible();
    await expect(page.getByText('Not Paid')).toBeVisible();
    await page.locator('.order-screen .card').scrollIntoViewIfNeeded();
    await breathe(page);

    const url = page.url();
    const orderIdMatch = url.match(/\/orders\/([^/?#]+)/);
    expect(orderIdMatch, `Expected order id in URL: ${url}`).toBeTruthy();
    const orderId = orderIdMatch[1];

    const token = await page.evaluate(() => {
      const raw = localStorage.getItem('userInfo');
      if (!raw) return '';
      try {
        return JSON.parse(raw).token || '';
      } catch {
        return '';
      }
    });
    expect(token, 'JWT missing from localStorage after login').toBeTruthy();

    const payRes = await payOrderViaApiForDemo(request, orderId, token);
    if (!payRes.ok()) {
      const body = await payRes.text();
      throw new Error(
        `Demo pay failed (${payRes.status()}): ${body.slice(0, 500)} ` +
          'For recordings: NODE_ENV≠production, PAYPAL_SKIP_VERIFY=true, and omit PAYPAL_CLIENT_SECRET (see env/backend/.env.example).'
      );
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toMatch(/Order /);
    await expect(page.getByText('Paid on')).toBeVisible({ timeout: 30_000 });
    await breathe(page);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'User Profile' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: orderId })).toBeVisible();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: orderId })
        .locator('td')
        .nth(3)
        .getByText(/\d{4}-\d{2}-\d{2}/)
    ).toBeVisible();
    await breathe(page);
  });
});
