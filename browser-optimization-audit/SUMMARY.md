# Browser audit summary (2026-05-14)

Automated pass against `http://127.0.0.1:3000/` (Docker nginx + static SPA). See `pages/` for per-route notes and raw observations.

## Critical findings

1. **Product APIs returning HTTP 500** — `GET /api/products/featured`, `GET /api/products?...`, `GET /api/products/1` all returned 500 in this session. That blocks home, listing, and detail flows. **Action:** verify Postgres is up, `DATABASE_URL` matches compose, schema applied (`backend/db/schema.js`), and seed data present. The UI surfaced SQL text `column "id" does not exist` on the product detail route — indicates a DB/schema mismatch or an older `products` table; align DB with the repo schema or run the app’s schema bootstrap.

2. **Wrong document title on product route** — Title appeared as `undefined size undefined` while the API was failing. **Root cause:** `productDetails` Redux slice defaulted to `{ product: {} }` with `loading` falsy, so the first render took the “success” branch with an empty `product` before `PRODUCT_DETAILS_REQUEST` ran; `Meta` interpolated undefined `brand` / `size`. **Fixed in code:** consistent `loading` / `product` shape on request and fail, and guarded `Meta` title.

## Performance / UX (network)

- **Third-party fonts** — Requests to `fonts.googleapis.com` / `fonts.gstatic.com` and Font Awesome on cdnjs. **Mitigation:** added `preconnect` + `dns-prefetch` in `frontend/index.html` for faster TLS/DNS; longer-term options are self-hosting subset fonts or trimming FA to used icons.

- **Font Awesome CSS** — Already loaded with `preload` + `onload` swap to stylesheet (good pattern).

## Accessibility (snapshot)

- Landmark: `main` exists with id `main-content` (from app shell).
- Nav links in header snapshot sometimes appear without accessible names (`ref` links with no `name`) — worth auditing `Header` for `aria-label` on icon-only controls.
- Login / register forms expose labeled textboxes (`Email Address`, `Password`, etc.).

## Implemented optimizations (this pass)

- `frontend/src/store/reducers/productReducers.jsx` — `productDetails` initial and transition state avoids a “success” flash with `{}` product; clears product on refetch and failure.
- `frontend/src/screens/ProductScreen.jsx` — `Meta` title uses product name / site fallback; only sets SEO title when `product._id` is present.
- `frontend/index.html` — `dns-prefetch` / `preconnect` for Google Fonts and cdnjs.

## Follow-ups (not done here)

- Resolve API 500s at source (database + migrations + env).
- Header icon links: ensure every interactive control has a discernible name for screen readers.
- Consider `fetchpriority="high"` for LCP hero image on home once product imagery loads again.
