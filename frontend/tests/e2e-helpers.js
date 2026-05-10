/**
 * Shared Playwright E2E utilities (API reachability + product helpers).
 */

const DEFAULT_API_ORIGIN =
  process.env.E2E_API_ORIGIN || process.env.DEV_PROXY_TARGET || 'http://127.0.0.1:5002';

function getApiOrigin() {
  return DEFAULT_API_ORIGIN.replace(/\/$/, '');
}

function isLoopbackApiOrigin(base) {
  try {
    const u = new URL(base.includes('://') ? base : `http://${base}`);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Wait until the backend answers GET /api/health.
 * Fails fast if port 5173 responds but the API does not (Vite-only process).
 */
async function ensureApiReady(request) {
  const base = getApiOrigin();
  const healthUrl = `${base}/api/health`;

  if (!isLoopbackApiOrigin(base)) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      try {
        const r = await request.get(healthUrl);
        if (r.ok()) return;
      } catch {
        /* transient network / cold start */
      }
      await new Promise((res) => setTimeout(res, 1500));
    }
    throw new Error(`Timed out waiting for ${healthUrl}.`);
  }

  let firstFailure = true;
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const r = await request.get(healthUrl);
      if (r.ok()) {
        return;
      }
    } catch {
      /* connection refused while stack boots */
    }

    if (firstFailure) {
      firstFailure = false;
      try {
        const viteProbe = await request.get('http://127.0.0.1:5173/');
        if (viteProbe.ok()) {
          try {
            const r = await request.get(healthUrl);
            if (r.ok()) {
              return;
            }
          } catch {
            /* keep waiting */
          }
          throw new Error(
            `API not reachable at ${base} (GET ${healthUrl}) but port 5173 responds. ` +
              'Another process may be running Vite without the backend. Stop it, or run a full `npm run dev` ' +
              'from frontend/ (starts API + Vite), or set PW_REUSE_SERVER=0 so Playwright starts the stack. ' +
              'Ensure Postgres is running and DATABASE_URL is set for the API.'
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('API not reachable at')) {
          throw e;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(
    `Timed out waiting for ${healthUrl}. Start Postgres, configure DATABASE_URL (backend/db/.env), ` +
      'then run `npm run dev` from frontend/ or let Playwright start it (no Vite-only process on 5173).'
  );
}

async function registerUserViaApi(request, { name, email, password }) {
  const res = await request.post(`${getApiOrigin()}/api/users`, {
    data: { name, email, password },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`register failed ${res.status()}: ${body}`);
  }
}

/**
 * First catalog product with inventory (for cart / checkout flows).
 * @param {{ optional?: boolean }} [options] If optional is true, returns null when none in stock / empty list.
 */
async function fetchFirstInStockProduct(request, options = {}) {
  const { optional = false } = options;
  const res = await request.get(
    `${getApiOrigin()}/api/products?pageNumber=1&pageSize=50`
  );
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`GET /api/products failed ${res.status()}: ${body}`);
  }
  const data = await res.json();
  const products = data.products || [];
  const product = products.find((p) => Number(p.countInStock) > 0);
  if (!product) {
    if (optional) {
      return null;
    }
    throw new Error(
      'E2E needs at least one product with countInStock > 0 in the database.'
    );
  }
  return product;
}

module.exports = {
  getApiOrigin,
  ensureApiReady,
  registerUserViaApi,
  fetchFirstInStockProduct,
};
