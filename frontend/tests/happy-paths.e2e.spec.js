/**
 * Documented happy paths (customer-facing flows we assert end-to-end):
 *
 * 1. Home — storefront loads with visible branding (Header).
 * 2. Browse — /products shows "Latest Products" and loads the catalog (or empty-state copy).
 * 3. Search — submitting the header search with an empty keyword opens the full product list (/products).
 * 4. Product detail — opening an in-stock product shows "Add to Cart"; click adds item and navigates to cart.
 * 5. Register — new shopper completes Sign Up and lands on home with their name in the header.
 * 6. Checkout — signed-in shopper: cart → shipping → payment → place order → order page shows order id + items.
 * 7. Profile — signed-in shopper sees "User Profile" and "My Orders".
 *
 * Prereqs: same as login.e2e.spec.js (`npm run dev` from frontend/, Postgres + DATABASE_URL).
 * Run: npm run test:e2e -- tests/happy-paths.e2e.spec.js
 *
 * Cart and checkout specs are skipped when the API returns no products with countInStock > 0
 * (empty database). Seed the catalog locally to exercise those flows.
 */

const { test, expect } = require('@playwright/test');
const {
  ensureApiReady,
  getApiOrigin,
  registerUserViaApi,
  fetchFirstInStockProduct,
} = require('./e2e-helpers');

const runId = process.env.GITHUB_RUN_ID || String(Date.now());

test.describe('Customer happy paths', () => {
  test.beforeAll(async ({ request }) => {
    await ensureApiReady(request);
  });

  test('home page shows store branding', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /Tailored by Boutique/i })
    ).toBeVisible();
  });

  test('browse inventory shows Latest Products', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Latest Products' })).toBeVisible({
      timeout: 30_000,
    });
    const emptyState = page.getByText('There are currently no items');
    const firstProductLink = page.locator('a[href^="/products/"]').first();
    await expect(emptyState.or(firstProductLink)).toBeVisible({ timeout: 30_000 });
  });

  test('empty header search navigates to the full product list', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Submit product search' }).click();
    await expect(page).toHaveURL(/\/products\/?$/);
    await expect(page.getByRole('heading', { name: 'Latest Products' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('product page Add to Cart goes to cart with line item', async ({
    page,
    request,
  }) => {
    const product = await fetchFirstInStockProduct(request, { optional: true });
    test.skip(
      !product,
      'Needs at least one in-stock product in the DB (seed or import catalog).'
    );
    await page.goto(`/products/${product._id}`);
    await expect(
      page.getByRole('button', { name: 'Add to Cart' })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page).toHaveURL(/\/cart\/?$/);
    await expect(page.getByRole('link', { name: product.name })).toBeVisible();
  });

  test('register then lands on home with session', async ({ page }) => {
    const email = `e2e-happy-register-${runId}@example.com`;
    const password = 'e2ePass99';
    const name = 'E2E Happy Register';

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
    await page.locator('#name').fill(name);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.locator('#username')).toContainText(name);

    const stored = await page.evaluate(() => localStorage.getItem('userInfo'));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored).email).toBe(email);
  });

  test('checkout flow creates an order and shows order screen', async ({
    page,
    request,
  }) => {
    const product = await fetchFirstInStockProduct(request, { optional: true });
    test.skip(
      !product,
      'Needs at least one in-stock product in the DB (seed or import catalog).'
    );
    const email = `e2e-happy-checkout-${runId}@example.com`;
    const password = 'e2ePass99';
    const name = 'E2E Happy Checkout';

    await registerUserViaApi(request, { name, email, password });

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    await page.goto(`/products/${product._id}`);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page).toHaveURL(/\/cart\/?$/);

    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
    await expect(page).toHaveURL(/\/shipping\/?$/, { timeout: 20_000 });

    await page.locator('#address').fill('123 E2E Street');
    await page.locator('#city').fill('Testville');
    await page.locator('#postalCode').fill('12345');
    await page.locator('#country').fill('United States');
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    await expect(page).toHaveURL(/\/payment\/?$/);

    await page.getByRole('button', { name: 'Continue to Place Order' }).click();
    await expect(page).toHaveURL(/\/placeorder\/?$/);

    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1 })).toMatch(/Order /);
    await expect(page.getByRole('heading', { name: 'Order Items' })).toBeVisible();
    await expect(page.getByRole('link', { name: product.name })).toBeVisible();
  });

  test('profile screen loads for a signed-in user', async ({ page, request }) => {
    const email = `e2e-happy-profile-${runId}@example.com`;
    const password = 'e2ePass99';
    const name = 'E2E Happy Profile';

    await registerUserViaApi(request, { name, email, password });

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'User Profile' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
  });
});

test.describe('API smoke (same origin as Vite proxy)', () => {
  test('health responds', async ({ request }) => {
    await ensureApiReady(request);
    const r = await request.get(`${getApiOrigin()}/api/health`);
    expect(r.ok()).toBeTruthy();
  });
});
