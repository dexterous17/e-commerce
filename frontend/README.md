# Frontend

React 18 + Vite application for the e-commerce storefront.

## Stack

| Layer | Library |
|-------|---------|
| UI | React 18, React Bootstrap 1.6 |
| Routing | React Router 6 |
| State | Redux 4 + Redux Thunk |
| Build | Vite 8 |
| HTTP | Axios 1.14 |
| Payment | PayPal React SDK |
| Testing | Playwright (E2E) |

---

## Development

From the **repo root** — starts Express API (port 5002) + Vite (port 5173) together:

```bash
npm start
# or from frontend/
npm run dev
```

Vite only (API must already be running):

```bash
npm run start:vite-only
```

Vite dev server: `http://localhost:5173`

Vite proxies `/api`, `/uploads`, and `/upload` to `http://localhost:5002` by default. Override with `DEV_PROXY_TARGET` in `env/frontend/.env`.

---

## Build

```bash
npm run build
```

Output → `dist/`. The backend's Nginx container serves this directory in production.

Preview the production build locally:

```bash
npm run preview
```

---

## Environment

Copy `env/frontend/.env.example` to `env/frontend/.env`.

| Variable | Purpose |
|----------|---------|
| `DEV_PROXY_TARGET` | Vite dev proxy target for `/api` (default: `http://localhost:5002`) |
| `VITE_API_ORIGIN` | Production API origin for split-domain deploys (e.g. `https://backend.ecommerce.harshildex.com`). Leave empty for same-origin requests. |

`VITE_API_ORIGIN` is also accepted as a Docker build ARG (`--build-arg VITE_API_ORIGIN=...`) so it gets baked into the Vite build at image build time.

---

## E2E Tests

```bash
# Install browsers (first time only)
npm run test:e2e:install

# Run tests
npm run test:e2e
```

Requires a running dev server.

---

## Project Structure

```
src/
├── App.jsx          React Router setup (22 routes, all screens lazy-loaded)
├── store.jsx        Redux store
├── apiBase.js       Axios instance (base URL from VITE_API_ORIGIN or same-origin)
├── actions/         Redux async action creators (products, users, cart, orders)
├── reducers/        Redux state reducers
├── constants/       Redux action type string constants
├── screens/         Page-level components (lazy-loaded on demand)
│   ├── HomeScreen.jsx
│   ├── AllProductsScreen.jsx   Browse + search + filter + paginate
│   ├── ProductScreen.jsx
│   ├── CartScreen.jsx
│   ├── LoginScreen.jsx
│   ├── RegisterScreen.jsx
│   ├── ProfileScreen.jsx
│   ├── ShippingScreen.jsx
│   ├── PaymentScreen.jsx
│   ├── PlaceOrderScreen.jsx
│   ├── OrderScreen.jsx
│   ├── ProductListScreen.jsx   (admin)
│   ├── ProductEditScreen.jsx   (admin)
│   ├── UserListScreen.jsx      (admin)
│   ├── UserEditScreen.jsx      (admin)
│   └── OrderListScreen.jsx     (admin)
└── components/      Reusable UI (Header, Footer, Product card, Carousel,
                     SearchBox, Paginate, CheckoutSteps, Modals, BunnyLoader, etc.)
```

---

## Routes

| Path | Screen | Auth |
|------|--------|------|
| `/` | HomeScreen | — |
| `/products` | AllProductsScreen | — |
| `/products/page/:pageNumber` | AllProductsScreen | — |
| `/products/search/:keyword` | AllProductsScreen | — |
| `/products/search/:keyword/page/:pageNumber` | AllProductsScreen | — |
| `/products/search/:keyword/:filter` | AllProductsScreen | — |
| `/products/search/:keyword/page/:pageNumber/:filter` | AllProductsScreen | — |
| `/products/:id` | ProductScreen | — |
| `/cart` | CartScreen | — |
| `/cart/:id` | CartScreen | — |
| `/login` | LoginScreen | — |
| `/register` | RegisterScreen | — |
| `/profile` | ProfileScreen | Protected |
| `/shipping` | ShippingScreen | Protected |
| `/payment` | PaymentScreen | Protected |
| `/placeorder` | PlaceOrderScreen | Protected |
| `/orders/:id` | OrderScreen | Protected |
| `/admin/userlist` | UserListScreen | Admin |
| `/admin/users/:id/edit` | UserEditScreen | Admin |
| `/admin/productlist` | ProductListScreen | Admin |
| `/admin/productlist/:pageNumber` | ProductListScreen | Admin |
| `/admin/products/:id/edit` | ProductEditScreen | Admin |
| `/admin/orderlist` | OrderListScreen | Admin |

---

## Code Splitting

Vite splits the bundle into named chunks for optimal cache utilisation:

| Chunk | Contents |
|-------|---------|
| `react-vendor` | React + React DOM |
| `router` | React Router |
| `redux` | Redux + React-Redux |
| `ui-bootstrap` | React Bootstrap + Bootstrap CSS |
| main bundle | App code + components |

All screens are `lazy()`-loaded with an error boundary that catches chunk-load failures (e.g. stale cache after a deploy) and falls back to the `BunnyLoader` component.
