# Route: `/` (Home)

- **Title:** Tailored by Boutique - Welcome
- **Console:** Only Cursor automation warnings (non-app).
- **Network (representative):**
  - `GET /api/products/featured` → **500**
  - `GET /api/products?pageNumber=1&pageSize=40&keyword=&filter=` → **500**
  - Google Fonts CSS + woff2, Font Awesome woff2 → 200
- **A11y snapshot:** Brand link, toggle navigation, search field/region, welcome headings, collage region labeled “Boutique photo collage and welcome”.
- **Notes:** Featured and grid data depend on product API; failures degrade home content. Font third-parties add latency — preconnect helps.
