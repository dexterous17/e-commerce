# E-Commerce App

Full-stack e-commerce application — product browsing with search/filter/pagination, shopping cart, multi-step checkout with PayPal, and an admin panel for products, users, and orders. Images are stored locally, in a private **AWS S3** bucket, or in **local MinIO** (S3-compatible object storage in Docker Compose); the API can proxy private objects through `/api/media/s3`.

## Table of Contents

<details>
<summary><strong>Browse sections</strong> (click to expand)</summary>

| Section | What you'll find |
|:--------|:-----------------|
| [**Tech Stack**](#tech-stack) | Backend, frontend, and infrastructure at a glance |
| [**Project Structure**](#project-structure) | Repo layout and what each folder is for |
| [**Demo videos**](#demo-videos) | Playwright walkthrough recordings (embedded below) |
| [**Docker Setup**](#docker-setup) | Compose stack, ports, and how to run in containers |
| [**Local Development**](#local-development) | Vite, API proxy, and day-to-day dev on the host |
| [**Backend on Your Machine (PostgreSQL)**](#backend-on-your-machine-postgresql) | Installing and wiring Postgres for the API |
| [**Environment Variables**](#environment-variables) | Env files, secrets, and configuration reference |
| [**Database Schema**](#database-schema) | Tables, relationships, and data model |
| [**API Reference**](#api-reference) | HTTP routes and payloads |
| [**Docker MCP (Cursor)**](#docker-mcp-cursor) | Using Docker from Cursor’s MCP tools |
| [**Deployment (Lightsail)**](#deployment-lightsail) | Production deploy on AWS Lightsail |
| [**Data Seeding**](#data-seeding) | Loading sample products and users |
| [**Process guides (chat walkthroughs)**](docs/process/README.md) | Step-by-step process docs outside this file |

</details>

---

## Tech Stack

<details>
<summary><strong>Backend</strong> (API, data, auth, uploads)</summary>

| Area | What it is | In this project |
|:-----|:------------|:----------------|
| **Runtime & HTTP** | JavaScript server and REST layer | Node.js **22.5+** (ES modules), **Express 4** |
| **Database** | Relational store and driver | **PostgreSQL 16** via **`pg`** |
| **Authentication** | Tokens and password hashing | **JWT** (`HS256`) + **bcrypt** |
| **Object storage** | Product images in the cloud or locally | **AWS SDK v3** — **AWS S3** in production; **MinIO** locally via `AWS_S3_ENDPOINT_URL` (same SDK client; URLs proxied by the API when `AWS_S3_IMAGE_PROXY=true`) |
| **HTTP hardening** | Headers, cross-origin rules, abuse limits | **Helmet**, **CORS**, **express-rate-limit** |
| **Multipart uploads** | Accepting image files from clients | **Multer** |

</details>

<details>
<summary><strong>Frontend</strong> (UI, state, payments, tests)</summary>

| Area | What it is | In this project |
|:-----|:------------|:----------------|
| **UI library** | Components and rendering | **React 18** |
| **Dev server & build** | Local dev and production bundles | **Vite 8** |
| **Routing** | URLs and navigation in the SPA | **React Router 6** |
| **State & async** | Global store and side effects | **Redux 4** + **Redux Thunk** |
| **Layout & widgets** | Prebuilt accessible UI primitives | **React Bootstrap 1.6** |
| **API calls** | Browser HTTP to the backend | **Axios 1.14** |
| **Checkout** | PayPal buttons and payment flow | **PayPal React SDK** |
| **Quality** | End-to-end browser tests | **Playwright** |

</details>

<details>
<summary><strong>Infrastructure</strong> (compose, hosting, TLS)</summary>

| Area | What it is | In this project |
|:-----|:------------|:----------------|
| **Local / full stack** | Reproducible multi-service environment for development and demos | **Docker Compose**: **Postgres**; **MinIO** (S3-compatible local object store + one-shot bucket init); **Node/Express** API; **Nginx** (built SPA + `/api` proxy); **Portainer** (container UI); **Nginx Proxy Manager** (reverse proxy and TLS) |
| **Production hosting** | Cloud VM where the deployed app runs | **AWS Lightsail** |
| **HTTPS & certificates** | Public TLS for the site and proxy routing | **Let's Encrypt** with **Nginx Proxy Manager** |

</details>

---

## Project Structure

```
/
├── backend/
│   ├── server.js           Express app entry point
│   ├── routes/             6 route files (products, users, orders, upload, media, paypal)
│   ├── controllers/        Business logic (products, users, orders)
│   ├── models/             DB queries (users, products, orders, seedManifest)
│   ├── middleware/         Auth (JWT), error handler, security (Helmet/CORS/rate-limit)
│   ├── config/             DB connection, env loader
│   ├── utils/              JWT helpers, S3/MinIO client (`createS3Client`), URL rewriting, PayPal verify
│   ├── db/schema.js        PostgreSQL DDL (auto-runs on start)
│   ├── data/               Seed data & S3 manifest
│   └── scripts/            Dev utilities (env init, image sync, S3 upload)
├── frontend/
│   ├── src/
│   │   ├── App.jsx         Router (22 routes, lazy-loaded screens)
│   │   ├── screens/        13 page components (inc. 5 admin screens)
│   │   ├── components/     Reusable UI components
│   │   ├── actions/        Redux async action creators
│   │   ├── reducers/       Redux state reducers
│   │   ├── constants/      Redux action type constants
│   │   └── store.jsx       Redux store
│   └── vite.config.js      Dev proxy, code splitting config
├── env/                    .env.example templates (backend, frontend, docker, aws, database)
├── secrets/                Docker secrets (git-ignored)
├── scripts/                Deployment, MinIO init/sync (`minio-init-bucket.sh`, `sync-minio-to-s3.sh`), build
├── deploy/                 Lightsail-specific deploy scripts
├── docker-compose.yml      Full stack (Postgres + MinIO + Node + Nginx + Portainer + NPM)
├── docker-compose.lightsail.yml
└── docker-compose.nginx-proxy-manager.yml
```

---

## Demo videos

Playwright screen recordings are in [`assets/`](../assets/) (source) and published to the [**demo-videos** release](https://github.com/dexterous17/e-commerce/releases/tag/demo-videos) for **inline players** in this README.

Regenerate: [`docs/demo-videos/REGENERATE.txt`](../docs/demo-videos/REGENERATE.txt) — `cd frontend && npm run test:e2e:demo-videos`, then `npm run publish-demo-videos` (needs **ffmpeg** + **gh**).

| # | Demo | Description |
| --- | --- | --- |
| 01 | **Storefront tour** | Storefront tour — home, browse, product, add to cart |
| 02 | **Register session** | Register session |
| 03 | **Checkout flow** | Sign in, shipping, payment step, place order, confirmation |
| 04 | **Search catalog** | Search catalog |
| 05 | **Sign in session** | Sign in session |
| 06 | **Profile & orders** | Profile & orders — checkout, pay, My Orders listing |

### 01 — Storefront tour

Storefront tour — home, browse, product, add to cart

https://github.com/user-attachments/assets/0f27a881-bb3c-4fd5-b7f0-2f6841e78d7b

### 02 — Register session

Register session

https://github.com/user-attachments/assets/fecbf889-c83e-4d2c-937e-0431fb42fd1c

### 03 — Checkout flow

Checkout — sign in, shipping, payment step, place order, confirmation

https://github.com/user-attachments/assets/fcaeb85e-6098-40d9-b8d9-3b1f1a692779

### 04 — Search catalog

Search catalog

https://github.com/user-attachments/assets/6eb20522-a5e3-466d-a44e-7d4faffecef8

### 05 — Sign in session

Sign in session

https://github.com/user-attachments/assets/a5e8fa11-f901-49b4-a723-3f4351023cf9

### 06 — Profile & orders

Profile & orders — checkout, pay, My Orders listing

https://github.com/user-attachments/assets/faa7c06b-246b-4fe8-8d96-8aa640231f00

---

## Docker Setup

The default `docker-compose.yml` runs:

| Service | Image | Host Port | Purpose |
|---------|-------|-----------|---------|
| `postgres` | postgres:16-alpine | 127.0.0.1:5432 | Database |
| `minio` | minio/minio | 127.0.0.1:${MINIO_API_PORT:-9010} (API), ${MINIO_CONSOLE_PORT:-9011} (console) | Local S3-compatible object storage |
| `minio-init` | minio/mc | — | One-shot: creates bucket on MinIO (same name/prefix as AWS config) |
| `backend` | ./backend/Dockerfile | 127.0.0.1:${BACKEND_PORT:-5004} | Express API (points at `http://minio:9000` in Compose) |
| `frontend` | ./frontend/Dockerfile | ${FRONTEND_PORT:-3000} | Nginx + Vite build |
| `portainer` | portainer/portainer-ce | 127.0.0.1:9000 | Container management UI |
| `nginx-proxy-manager` | jc21/nginx-proxy-manager:2 | 80, 443, 81 (admin) | Reverse proxy + TLS |
| `npm-bootstrap` | python:3.12-alpine | — | One-shot NPM proxy config |

### Start

```bash
docker compose up --build
```

App: `http://localhost:3000` — API: `http://127.0.0.1:5004`

### Secrets

Create `secrets/jwt_secret.txt` with a strong random string before starting. This file is git-ignored.

```bash
openssl rand -hex 32 > secrets/jwt_secret.txt
```

The backend supports `*_FILE` env vars, so `PAYPAL_CLIENT_ID_FILE`, `AWS_ACCESS_KEY_ID_FILE`, `DATABASE_URL_FILE`, and `AWS_SECRET_ACCESS_KEY_FILE` can be wired as additional Docker secrets.

### Compose configuration (`.env`)

Copy `env/docker/.env.example` to repo-root `.env` to override Compose defaults:

```bash
cp env/docker/.env.example .env
```

### Object storage: AWS S3 and local MinIO

Production images live in a **private AWS S3 bucket** you create yourself. Local development can use the same bucket name and key prefix on **MinIO** (included in Compose) so paths stay aligned when you sync to AWS.

| Target | Who creates the bucket | Backend config |
|--------|------------------------|----------------|
| **AWS** | You (console / IaC) | `env/aws/.env` with IAM keys, region, `AWS_S3_BUCKET_NAME`, `AWS_S3_PUBLIC_BASE_URL` |
| **MinIO (local)** | `minio-init` on first `docker compose up` | Same bucket/prefix vars; add `AWS_S3_ENDPOINT_URL`, `AWS_S3_FORCE_PATH_STYLE=true`, and MinIO root user as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |

**Private S3 (or MinIO) via the API proxy** — create `env/aws/.env` from the example. Without credentials, `/api/media/s3` returns 403/500.

```bash
cp env/aws/.env.example env/aws/.env
# AWS: fill in AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
# Local MinIO (host `npm start`): see commented block in env/aws/.env.example
#   AWS_S3_ENDPOINT_URL=http://127.0.0.1:9010
#   AWS_S3_FORCE_PATH_STYLE=true
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY = MINIO_ROOT_USER / MINIO_ROOT_PASSWORD (default minioadmin)
```

In Compose, the **backend container** already sets `AWS_S3_ENDPOINT_URL=http://minio:9000` and path-style access; put matching keys in `env/aws/.env` (loaded via `env_file`).

**MinIO only (without full stack):**

```bash
npm run minio:up          # docker compose up -d minio minio-init
```

- API: `http://127.0.0.1:9010` (default; override with `MINIO_API_PORT` in repo-root `.env`)
- Console: `http://127.0.0.1:9011` (defaults avoid clashing with Portainer on **9000**)

**Push local objects to your real AWS bucket** (bucket must already exist in AWS):

```bash
npm run minio:mirror-to-s3
# or: ./scripts/sync-minio-to-s3.sh --dry-run
```

See [`docs/process/docker-compose-stack.md`](docs/process/docker-compose-stack.md) for a chat-style walkthrough of MinIO vs AWS.

---

## Local Development

From the **repo root** — starts the Express API (port 5002) and Vite dev server (port 5173) concurrently:

```bash
npm start
# or
npm run dev:all
```

Vite proxies `/api`, `/uploads`, and `/upload` to `http://localhost:5002` by default.

For **S3-backed product images** on the host (not full Compose), start Postgres and MinIO, then point `env/aws/.env` at `http://127.0.0.1:9010` (see `env/aws/.env.example`):

```bash
npm run postgres:up
npm run minio:up
```

To run **only** the Vite dev server (API already running separately):

```bash
npm run start:frontend
```

### Verify the API

```bash
curl -s http://127.0.0.1:5002/api/health
```

Expected response:

```json
{ "ok": true, "s3ImageProxy": true, "awsAccessKeyEnvSet": true, "listenPort": 5002, "nodeEnv": "development" }
```

`"awsAccessKeyEnvSet": false` is acceptable on AWS EC2/ECS if the SDK uses an instance role.

---

## Backend on Your Machine (PostgreSQL)

The API requires PostgreSQL. Options: local install, `docker compose up postgres`, or a hosted instance (RDS, Neon, etc.).

1. Initialise environment files:

   ```bash
   cd backend && npm run env:init
   ```

   Or manually copy `backend/db/.env.example` → `backend/db/.env`.

2. Set `DATABASE_URL` in `backend/db/.env`:

   ```
   DATABASE_URL=postgresql://ecommerce:ecommerce@localhost:5432/ecommerce
   ```

   Individual `PGHOST` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` vars also work.

3. Start the API:

   ```bash
   cd backend && npm start
   ```

### Port conflicts (`EADDRINUSE`)

macOS **AirPlay Receiver** uses port 5000 and returns 403, so the API defaults to **5002**. If 5002 is taken:

```bash
lsof -iTCP:5002 -sTCP:LISTEN
```

Stop the process, or set a free `PORT` in `env/backend/.env` and the matching `DEV_PROXY_TARGET` in `env/frontend/.env`.

Compose publishes the backend on **5004** by default so `docker compose up` and a local `npm start` (5002) can coexist.

---

## Environment Variables

All `.env.example` files live under `env/`. Copy each one to its target location and fill in real values.

### Backend (`env/backend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `production` | `development` enables verbose errors and relaxed rate limits |
| `PORT` | `5002` | API listen port (Docker container uses `5000`) |
| `SERVE_FRONTEND` | `false` | Serve `frontend/dist` from Express (production only) |
| `JWT_SECRET` | **required** | HS256 signing key for JWT tokens |
| `PAYPAL_CLIENT_ID` | optional | PayPal SDK client ID (safe to expose to browser) |
| `PAYPAL_CLIENT_SECRET` | optional | Server-side PayPal secret |
| `PAYPAL_WEBHOOK_ID` | optional | PayPal webhook ID for signature verification |
| `PAYPAL_SKIP_VERIFY` | `false` | Skip webhook signature check — **never set in production** |
| `CORS_ORIGIN` | optional | Comma-separated allowed origins (e.g. `https://shop.example.com`) |
| `TRUST_PROXY` | optional | Trust `X-Forwarded-*` headers (set when behind nginx/ALB) |
| `TRUST_PROXY_HOPS` | `1` | Number of trusted proxy hops |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms (15 min) |
| `RATE_LIMIT_MAX` | `400` prod / `2000` dev | Max API requests per window (S3 image traffic exempt) |
| `AUTH_RATE_LIMIT_MAX` | `40` | Max failed login attempts per window |
| `REGISTER_RATE_LIMIT_MAX` | `25` | Max registration attempts per window |

### Database (`backend/db/.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Full Postgres connection URI |
| `PGHOST` | `localhost` | Alternative to DATABASE_URL |
| `PGPORT` | `5432` | |
| `PGUSER` | `ecommerce` | |
| `PGPASSWORD` | `ecommerce` | |
| `PGDATABASE` | `ecommerce` | |

### Frontend (`env/frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `DEV_PROXY_TARGET` | Vite dev proxy for `/api` (default: `http://localhost:5002`) |
| `VITE_API_ORIGIN` | Production API origin for split-domain deploy (e.g. `https://backend.ecommerce.harshildex.com`). Leave empty for same-origin. |

### AWS / S3 / MinIO (`env/aws/.env`)

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | IAM credentials (AWS) or MinIO root user (local) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret (AWS) or MinIO root password (local) |
| `AWS_REGION` | S3 region (default: `us-east-1`) |
| `AWS_S3_BUCKET_NAME` | Bucket name (same name on MinIO and AWS keeps keys aligned) |
| `AWS_S3_PUBLIC_BASE_URL` | CDN, public S3 base URL, or MinIO path-style base (see `env/aws/.env.example`) |
| `AWS_S3_PREFIX` | Key prefix within bucket (default: `products`) |
| `AWS_S3_IMAGE_PROXY` | `true` to route images through `/api/media/s3` (private buckets) |
| `AWS_S3_ENDPOINT_URL` | Optional. Set to MinIO API URL (e.g. `http://127.0.0.1:9010` on host, `http://minio:9000` in Compose) to use MinIO instead of AWS |
| `AWS_S3_FORCE_PATH_STYLE` | `true` for MinIO (required for path-style URLs); Compose sets this on the backend service |

### Docker Compose (`.env` at repo root)

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_PORT` | `3000` | Published frontend port |
| `BACKEND_PORT` | `5004` | Published backend port |
| `PUBLIC_URL` | `/` | Frontend base path |
| `POSTGRES_DB` | `ecommerce` | |
| `POSTGRES_USER` | `ecommerce` | |
| `POSTGRES_PASSWORD` | `ecommerce` | |
| `PAYPAL_CLIENT_ID` | — | Injected into backend container |
| `AWS_REGION` | `us-east-1` | |
| `AWS_S3_BUCKET_NAME` | — | |
| `AWS_S3_PUBLIC_BASE_URL` | — | |
| `AWS_S3_PREFIX` | `products` | |
| `MINIO_API_PORT` | `9010` | Published MinIO S3 API (host → container 9000) |
| `MINIO_CONSOLE_PORT` | `9011` | MinIO web console |
| `MINIO_ROOT_USER` | `minioadmin` | MinIO admin user (use as `AWS_ACCESS_KEY_ID` locally) |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | MinIO admin password (change in non-dev environments) |

---

## Database Schema

Tables are created automatically on first API start (`backend/db/schema.js`).

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `_id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | |
| `email` | TEXT NOT NULL UNIQUE | |
| `password` | TEXT NOT NULL | bcrypt hash (10 rounds) |
| `is_admin` | BOOLEAN | default `false` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `products`
| Column | Type | Notes |
|--------|------|-------|
| `_id` | TEXT PK | UUID |
| `user_id` | TEXT FK→users | Product creator |
| `name`, `description` | TEXT NOT NULL | |
| `category`, `sub_category` | TEXT | |
| `sex`, `size`, `color`, `sub_color`, `brand` | TEXT | |
| `nwt` | BOOLEAN | New with tags |
| `price` | DOUBLE PRECISION | |
| `count_in_stock` | INTEGER ≥0 | default `1` |
| `images` | TEXT | JSON array of URLs |
| `local_images` | TEXT | JSON array (local upload snapshots) |
| `bucket_name`, `bucket_region`, `bucket_public_base_url`, `bucket_prefix` | TEXT | S3 metadata |
| `seed_source` | TEXT | Seeding origin |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Indexes on `user_id`, `name`, `category`, `sex`.

### `orders`
| Column | Type | Notes |
|--------|------|-------|
| `_id` | TEXT PK | UUID |
| `user_id` | TEXT FK→users (SET NULL on delete) | |
| `shipping_address` | TEXT | JSON object |
| `payment_method` | TEXT NOT NULL | e.g. `"PayPal"` |
| `payment_result` | TEXT | JSON (capture ID, status, timestamp) |
| `items_price`, `tax_price`, `shipping_price`, `total_price` | DOUBLE PRECISION | |
| `is_paid` | BOOLEAN | default `false` |
| `paid_at` | TIMESTAMPTZ | |
| `is_shipped` | BOOLEAN | default `false` |
| `shipped_at` | TIMESTAMPTZ | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `order_items`
| Column | Type | Notes |
|--------|------|-------|
| `_id` | TEXT PK | UUID |
| `order_id` | TEXT FK→orders (CASCADE delete) | |
| `name`, `images`, `price`, `qty`, `product_id` | — | Snapshot at order time |

### `seed_manifest`
Tracks product seeding history. `source` is the primary key (e.g. `"products-s3-manifest"`). Stores bucket metadata and the raw manifest JSON.

---

## API Reference

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`. Admin routes additionally require `is_admin = true`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/users/login` | — | Authenticate; returns user + JWT |
| `POST` | `/users` | — | Register new account |

Rate-limited: 40 failed login attempts / 15 min, 25 registrations / 15 min.

### Users (admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users` | Admin | List all users |
| `GET` | `/users/:id` | Admin | Get user by ID |
| `PUT` | `/users/:id` | Admin | Update user (name, email, isAdmin) |
| `DELETE` | `/users/:id` | Admin | Delete user |
| `GET` | `/users/profile` | Protected | Get own profile |
| `PUT` | `/users/profile` | Protected | Update own profile (name, email, password) |

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/products` | — | Paginated product list (supports `keyword`, `filter`, `pageNumber`, `pageSize`) |
| `GET` | `/products/featured` | — | Top 10 products by price |
| `GET` | `/products/:id` | — | Single product |
| `POST` | `/products` | Admin | Create product |
| `PUT` | `/products/:id` | Admin | Update product |
| `PATCH` | `/products/:id` | Admin | Set stock to 0 (soft remove from inventory) |
| `DELETE` | `/products/:id` | Admin | Delete product |

`GET /products` query params:
- `keyword` — search term
- `filter` — column to search: `name` (default), `brand`, `category`, `color`, `description`, `sex`, `size`, `subCategory`, `subColor`
- `pageNumber` — 1-based (default `1`)
- `pageSize` — default `50`, max `100`

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/orders` | Protected | Create order from cart (server validates prices + stock in a transaction) |
| `GET` | `/orders/myorders` | Protected | Current user's orders |
| `GET` | `/orders/:id` | Protected | Order detail (owner or admin) |
| `PUT` | `/orders/:id/pay` | Protected | Mark as paid (PayPal verification) |
| `GET` | `/orders` | Admin | All orders |
| `PUT` | `/orders/:id/ship` | Admin | Mark as shipped |

### Media & Upload

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/upload` | Admin | Upload product images (max 16, 5 MB each; JPEG/PNG) |
| `GET` | `/media/s3?key=<s3-key>` | — | Proxy private S3 or MinIO object (1-day cache) |

### Config & Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/config/paypal` | Returns `PAYPAL_CLIENT_ID` for browser SDK |
| `GET` | `/health` | API status: ok, S3 proxy state, port, NODE_ENV |

### PayPal Webhook

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhooks/paypal` | Receives `PAYMENT.CAPTURE.COMPLETED`; verifies HMAC-SHA256 signature, validates amount ±$0.02, marks order paid |

---

## Docker MCP (Cursor)

The repo includes [`.cursor/mcp.json`](.cursor/mcp.json), which starts the [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) gateway so Cursor can use MCP servers enabled in Docker Desktop. Requires Docker Desktop 4.62+.

```bash
docker mcp client connect cursor
# restart Cursor after changes
```

If Cursor Settings → MCP shows a broken Docker server alongside `MCP_DOCKER`, remove the duplicate and ensure `docker` is on the PATH for GUI-launched Cursor.

---

## Deployment (Lightsail)

`docker-compose.lightsail.yml` omits `postgres` and **MinIO** — use a managed Postgres instance and a real **AWS S3** bucket (`env/aws/.env` without `AWS_S3_ENDPOINT_URL`).

1. Copy env files and fill in production values (JWT secret, PayPal, AWS).
2. Create `secrets/jwt_secret.txt`.
3. Deploy:

```bash
./scripts/deploy-lightsail.sh
```

4. For TLS, use `docker-compose.nginx-proxy-manager.yml` and set `NPM_LETSENCRYPT_EMAIL` in `env/npm-bootstrap/.env`. The `npm-bootstrap` service auto-configures proxy hosts for `ecommerce.harshildex.com` and `backend.ecommerce.harshildex.com`.

---

## Data Seeding

Run from `backend/`:

```bash
# Local sample data
npm run data:import

# S3- or MinIO-backed products with bucket metadata (requires env/aws/.env + reachable bucket)
npm run data:import:s3

# From products-s3-manifest.json (production-style)
npm run data:import:s3:manifest

# Wipe database
npm run data:destroy
```

On Lightsail (wipes and re-seeds; run from repo root):

```bash
./scripts/lightsail-seed-from-manifest.sh
```

If the live shop shows no items but `/api/health` returns `ok: true`, the database is empty — run the seed above via SSH (`ssh -i /path/to/LightsailDefaultKey-*.pem …`; never commit `.pem` files).

The S3 seeder records:
- `products.images` — final image URLs (S3 or proxy)
- `products.local_images` — original local file paths
- `products.bucket_*` — S3 metadata per row
- `seed_manifest` — manifest + stats per seeding run
