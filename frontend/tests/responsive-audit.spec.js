// tests/responsive-audit.spec.js
// Audits all public pages at 4 viewport widths for:
//   1. No horizontal overflow
//   2. Reasonable heading font sizes at mobile
//   3. Key component widths within viewport
//   4. Screenshots for visual review (saved to test-results/screenshots/)
//
// Run: npx playwright test tests/responsive-audit.spec.js --reporter=html
// View: npx playwright show-report

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: 'mobile-375',  width: 375,  height: 812  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768  },
  { name: 'desktop-1440',width: 1440, height: 900  },
];

const PUBLIC_ROUTES = [
  { path: '/',          name: 'HomeScreen'         },
  { path: '/products',  name: 'AllProductsScreen'  },
  { path: '/login',     name: 'LoginScreen'        },
  { path: '/register',  name: 'RegisterScreen'     },
  { path: '/cart',      name: 'CartScreen'         },
];

// ── helpers ────────────────────────────────────────────────────────────────

/** Returns true when there is NO horizontal overflow */
async function noHorizontalOverflow(page) {
  return page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  });
}

/** Gets scrollWidth and clientWidth for reporting */
async function getScrollInfo(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth:  document.documentElement.clientWidth,
  }));
}

/** Returns computed font-size in px for the first element matching selector, or null */
async function computedFontSize(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? parseFloat(getComputedStyle(el).fontSize) : null;
  }, selector);
}

/** Returns bounding-rect width of first element matching selector, or null */
async function elementWidth(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().width : null;
  }, selector);
}

/** Waits for the page to settle (lazy chunks + layout paint) */
async function waitForSettle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);
}

// ── screenshot helper ──────────────────────────────────────────────────────

async function screenshotPage(page, vpName, routePath) {
  const dir = path.join(__dirname, '..', 'test-results', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${vpName}${routePath.replace(/\//g, '_') || '_home'}.png`;
  await page.screenshot({ path: path.join(dir, fileName), fullPage: true });
}

// ── test suites ────────────────────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    // ── 1. No horizontal overflow on every public page ─────────────────────
    for (const route of PUBLIC_ROUTES) {
      test(`${route.name} — no horizontal overflow`, async ({ page }) => {
        await page.goto(`${BASE_URL}${route.path}`);
        await waitForSettle(page);
        const { scrollWidth, clientWidth } = await getScrollInfo(page);
        expect(
          scrollWidth,
          `${route.name} @ ${vp.width}px: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`
        ).toBeLessThanOrEqual(clientWidth + 1);
      });
    }

    // ── 2. Home — carousel and gallery fit within viewport ─────────────────
    test('HomeScreen — carousel width ≤ viewport', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await waitForSettle(page);
      const w = await elementWidth(page, '.featured-carousel');
      if (w !== null) expect(w).toBeLessThanOrEqual(vp.width + 1);
    });

    test('HomeScreen — gallery width ≤ viewport', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await waitForSettle(page);
      const w = await elementWidth(page, '.gallery');
      if (w !== null) expect(w).toBeLessThanOrEqual(vp.width + 1);
    });

    // ── 3. AllProductsScreen — heading font sizes on mobile ─────────────────
    if (vp.width <= 375) {
      test('AllProductsScreen — h1 ≤ 28px on mobile', async ({ page }) => {
        await page.goto(`${BASE_URL}/products`);
        await waitForSettle(page);
        const size = await computedFontSize(page, 'h1');
        if (size !== null) {
          expect(size, `h1 too large at ${vp.width}px: ${size}px`).toBeLessThanOrEqual(28);
        }
      });

      test('AllProductsScreen — h2 ≤ 22px on mobile', async ({ page }) => {
        await page.goto(`${BASE_URL}/products`);
        await waitForSettle(page);
        const size = await computedFontSize(page, 'h2');
        if (size !== null) {
          expect(size, `h2 too large at ${vp.width}px: ${size}px`).toBeLessThanOrEqual(22);
        }
      });
    }

    // ── 4. Header / Navbar ≤ viewport width ───────────────────────────────
    test('Header — navbar width ≤ viewport', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await waitForSettle(page);
      const w = await elementWidth(page, '.navbar');
      if (w !== null) expect(w).toBeLessThanOrEqual(vp.width + 1);
    });

    // ── 5. Login / Register forms — no overflow ────────────────────────────
    test('LoginScreen — form renders without overflow', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await waitForSettle(page);
      const ok = await noHorizontalOverflow(page);
      expect(ok).toBe(true);
    });

    test('RegisterScreen — form renders without overflow', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
      await waitForSettle(page);
      const ok = await noHorizontalOverflow(page);
      expect(ok).toBe(true);
    });

    // ── 6. Cart — no overflow ─────────────────────────────────────────────
    test('CartScreen — no overflow', async ({ page }) => {
      await page.goto(`${BASE_URL}/cart`);
      await waitForSettle(page);
      const ok = await noHorizontalOverflow(page);
      expect(ok).toBe(true);
    });

    // ── 7. CSS info: log computed styles of key elements ──────────────────
    test(`CSS info snapshot — ${vp.name}`, async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await waitForSettle(page);

      const info = await page.evaluate(() => {
        const get = (sel, prop) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el)[prop] : 'not found';
        };
        return {
          'body.background-color':       get('body',          'backgroundColor'),
          'main.margin-top':             get('main',          'marginTop'),
          'navbar.height':               get('.navbar',       'height'),
          'h1.font-size':                get('h1',            'fontSize'),
          'h2.font-size':                get('h2',            'fontSize'),
          'carousel.height':             get('.featured-carousel', 'height'),
          'gallery.grid-template-cols':  get('.gallery',      'gridTemplateColumns'),
        };
      });

      console.log(`\n=== CSS Snapshot [${vp.name} ${vp.width}px] ===`);
      for (const [key, val] of Object.entries(info)) {
        console.log(`  ${key}: ${val}`);
      }

      // This test always passes — it's informational only
      expect(true).toBe(true);
    });

    // ── 8. Full-page screenshots ───────────────────────────────────────────
    test(`Screenshots — all public pages at ${vp.name}`, async ({ page }) => {
      for (const route of PUBLIC_ROUTES) {
        await page.goto(`${BASE_URL}${route.path}`);
        await waitForSettle(page);
        await screenshotPage(page, vp.name, route.path);
      }
    });
  });
}
