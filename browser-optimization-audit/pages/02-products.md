# Route: `/products`

- **Title:** Tailored by Boutique - Shopping
- **Network:** `GET /api/products?keyword=&pageNumber=1&pageSize=50&filter=` → **500**
- **Snapshot:** Header + search; main product grid not represented in compact snapshot (likely empty/error state).
- **Notes:** Same API dependency as home; fix listing endpoint for functional shop.
