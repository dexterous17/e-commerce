# Docker Setup

This repository now runs with separate Docker containers for:

- `frontend`: Nginx serving the Vite build and proxying `/api` and `/uploads`
- `backend`: Node/Express API with **SQLite** (database file on the `backend_sqlite` volume at `/app/backend/data/ecommerce.sqlite` inside the container)

## Start

```bash
docker compose up --build
```

For **product images** from a **private** S3 bucket, the backend must call S3 with credentials. Create **`env/aws/.env`** from **`env/aws/.env.example`** with **`AWS_ACCESS_KEY_ID`** and **`AWS_SECRET_ACCESS_KEY`** (same as local `npm start`); Compose loads it into the **`backend`** service. Without it, APIs may return `/api/media/s3` URLs that respond **403/500**.

The app is available at `http://localhost:3000` by default.
The API is published on the host at **`http://127.0.0.1:<BACKEND_PORT>`** (Compose default **5004**; copy **`env/docker/.env.example`** to repo-root **`.env`** for compose variables).

## Secrets

Docker Compose reads secrets from:

- `secrets/jwt_secret.txt`

Optional non-secret configuration for Compose lives in repo-root **`.env`**. The template is **`env/docker/.env.example`** (copy to **`.env`** at the repo root).

The backend also supports Docker's standard `*_FILE` pattern, so additional values such as `PAYPAL_CLIENT_ID_FILE`, `AWS_ACCESS_KEY_ID_FILE`, or `AWS_SECRET_ACCESS_KEY_FILE` can be wired in the same way if needed.

## Local dev (API + Vite, no Docker for Node)

From the **repo root**, **`npm start`** runs **`npm run dev` in `backend/`**, which starts the **Express API** (default port **5002**) and **Vite** (**5173**) together. Use **`npm run start:frontend`** if you only need the Vite dev server (you must run the API separately with **`cd backend && npm start`**).

Sanity-check the API you are talking to: **`curl -s http://127.0.0.1:5002/api/health`** should return JSON with **`"ok":true`**, **`"s3ImageProxy":true`**, and usually **`"awsAccessKeyEnvSet":true`** when using keys in **`env/aws/.env`** (legacy **`aws/.env`** still works) (otherwise `/api/media/s3` cannot read private objects). **`awsAccessKeyEnvSet":false`** can still be OK on AWS if the SDK uses an instance role.

## Backend on your machine (SQLite)

The API uses **Node.js built-in SQLite** (`node:sqlite`). **Node 22.5+** is required.

1. Run **`cd backend && npm run env:init`** (or copy **`backend/db/.env.example`** to **`backend/db/.env`**).
2. Optional: set **`SQLITE_DATABASE_PATH`** in **`backend/db/.env`** (default: **`data/ecommerce.sqlite`** under **`backend/`**).
3. **`cd backend && npm start`**

On macOS, **AirPlay Receiver** commonly listens on **5000** and answers HTTP with **403**, so local **`npm start`** defaults to **5002** (see **`env/backend/.env.example`**) and Vite’s dev proxy targets **`http://localhost:5002`** unless you set **`DEV_PROXY_TARGET`** in **`env/frontend/.env`**. If you run the API on another port, set **`PORT`** in **`env/backend/.env`** and the same URL in **`DEV_PROXY_TARGET`**.

### Port already in use (`EADDRINUSE`)

If **`npm start`** fails because the port is taken, another process is still bound there (often a previous **`node server.js`** or **`docker compose`** publishing the API). Inspect listeners with `lsof -iTCP:5002 -sTCP:LISTEN` (replace **`5002`** with your **`PORT`**), stop that process, or pick a free **`PORT`** and set matching **`DEV_PROXY_TARGET`** in **`env/frontend/.env`**. Compose defaults **`BACKEND_PORT`** to **5004** so host **`npm start`** on **5002** can run alongside **`docker compose up`** for the full stack—avoid setting **`BACKEND_PORT=5002`** in root `.env` unless you intentionally use only one API listener on that port.

## Docker MCP (Cursor)

The repo includes [`.cursor/mcp.json`](.cursor/mcp.json), which starts the [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) gateway (`docker mcp gateway run`) so Cursor can use MCP servers you enable in Docker Desktop (**MCP Toolkit** → catalog, e.g. Playwright). Requires **Docker Desktop** 4.62+ with the toolkit available.

To (re)attach Cursor from the CLI (writes/updates project MCP config):

```bash
docker mcp client connect cursor
```

Restart Cursor after MCP changes. If **Cursor Settings → MCP** shows a broken Docker-related server alongside **`MCP_DOCKER`**, remove the duplicate so Cursor only runs one gateway, and ensure **`docker`** is on the `PATH` for GUI-launched Cursor.

## Backend On Existing Server

1. From the repo root, run **`cd backend && npm run env:init`** (or copy each **`env/<system>/.env.example`** and **`backend/db/.env.example`** to the matching **`.env`** files).
2. Set the real values for:
   - **`SQLITE_DATABASE_PATH`** in **`backend/db/.env`** if the default file location is wrong for your host
   - `JWT_SECRET` and PayPal IDs in **`env/backend/.env`**
   - AWS keys in **`env/aws/.env`** if you use S3
3. Install backend dependencies and start the API from the `backend/` directory:

```bash
npm install
npm start
```

If you want to recreate the seeded database contents from code:

```bash
# plain sample seed
npm run data:import

# S3-backed product seed with bucket metadata + seed_manifest
npm run data:import:s3

# From products-s3-manifest.json (images already in S3) — used for production-style catalogs
npm run data:import:s3:manifest
```

**Lightsail / Docker** (run on the server from the repo root; wipes seeded users/products first):

```bash
./scripts/lightsail-seed-from-manifest.sh
# equivalent:
# docker compose -f docker-compose.lightsail.yml exec backend npm run data:import:s3:manifest
```

If [the live shop](http://ecommerce.harshildex.com/) shows no items but `/api/health` is OK, the database is usually empty — run the seed step above (SSH with your own key file, e.g. `ssh -i /path/to/LightsailDefaultKey-*.pem …`; never commit `.pem` files).

The S3 seeder stores:

- product image URLs in `products.images`
- original local file references in `products.local_images`
- bucket metadata in the product row and in `seed_manifest`

The backend schema (SQLite) mirrors the former Postgres layout:

- `users._id`, `products._id` (UUID strings)
- `products.images` stored as JSON text
- `orders`, `order_items`, and `seed_manifest` created on first API start if missing
