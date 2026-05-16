# Code changes tied to this audit

| File | Change |
|------|--------|
| `frontend/src/store/reducers/productReducers.jsx` | `productDetails` initial state `loading: true`; request clears `product`/`error`; fail clears `product`. Removes false “success” render with `{}`. |
| `frontend/src/screens/ProductScreen.jsx` | `Meta` on loading / error / success with safe titles; success title uses `name \| brand`. |
| `frontend/index.html` | `dns-prefetch` + `preconnect` for Google Fonts and cdnjs. |

**Docker static site (port 3000):** rebuild the frontend image or run a fresh `docker compose build` so nginx serves the new bundle.
