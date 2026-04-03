# Docker Setup

This repository now runs with separate Docker containers for:

- `frontend`: Nginx serving the Vite build and proxying `/api` and `/uploads`
- `backend`: Node/Express API
- `postgres`: PostgreSQL database

## Start

```bash
docker compose up --build
```

For **product images** from a **private** S3 bucket, the backend must call S3 with credentials. Create **`aws/.env`** from **`aws/.env.example`** with **`AWS_ACCESS_KEY_ID`** and **`AWS_SECRET_ACCESS_KEY`** (same as local `npm start`); Compose loads it into the **`backend`** service. Without it, APIs may return `/api/media/s3` URLs that respond **403/500**.

The app is available at `http://localhost:3000` by default.
The API is published on the host at **`http://127.0.0.1:<BACKEND_PORT>`** (Compose default **5004**; see `.env.example`).

## Secrets

Docker Compose reads secrets from:

- `secrets/postgres_password.txt`
- `secrets/jwt_secret.txt`

Optional non-secret configuration lives in `.env`. A template is provided at `.env.example`.

The backend also supports Docker's standard `*_FILE` pattern, so additional values such as `PAYPAL_CLIENT_ID_FILE`, `AWS_ACCESS_KEY_ID_FILE`, or `AWS_SECRET_ACCESS_KEY_FILE` can be wired in the same way if needed.

If you need a custom Postgres CA certificate, mount it into the backend container and point `PGSSLROOTCERT` or `PGSSLROOTCERT_PATH` at that file.

## Local dev (API + Vite, no Docker for Node)

From the **repo root**, **`npm start`** runs **`npm run dev` in `backend/`**, which starts the **Express API** (default port **5002**) and **Vite** (**5173**) together. Use **`npm run start:frontend`** if you only need the Vite dev server (you must run the API separately with **`cd backend && npm start`**).

Sanity-check the API you are talking to: **`curl -s http://127.0.0.1:5002/api/health`** should return JSON with **`"ok":true`**, **`"s3ImageProxy":true`**, and usually **`"awsAccessKeyEnvSet":true`** when using keys in `aws/.env` or `backend/.env` (otherwise `/api/media/s3` cannot read private objects). **`awsAccessKeyEnvSet":false`** can still be OK on AWS if the SDK uses an instance role.

## Backend on your machine (Postgres in Docker)

To run `npm start` inside `backend/` while Postgres runs in Compose:

1. From the repo root, start only the database: `docker compose up -d postgres`
2. Ensure `backend/.env` uses `PGHOST=127.0.0.1`, `PGPORT=5432`, and the same `PGUSER` / `PGPASSWORD` as Compose (defaults: user `ecommerce`, password in `secrets/postgres_password.txt`).
3. `cd backend && npm start`

The `postgres` service publishes `127.0.0.1:5432` so the host can connect.

On macOS, **AirPlay Receiver** commonly listens on **5000** and answers HTTP with **403**, so local **`npm start`** defaults to **5002** (see `backend/.env.example`) and Vite’s dev proxy targets **`http://localhost:5002`** unless you set **`DEV_PROXY_TARGET`**. If you run the API on another port, set **`PORT`** in `backend/.env` and the same URL in **`DEV_PROXY_TARGET`** in `frontend/.env`.

### Port already in use (`EADDRINUSE`)

If **`npm start`** fails because the port is taken, another process is still bound there (often a previous **`node server.js`** or **`docker compose`** publishing the API). Inspect listeners with `lsof -iTCP:5002 -sTCP:LISTEN` (replace **`5002`** with your **`PORT`**), stop that process, or pick a free **`PORT`** and set matching **`DEV_PROXY_TARGET`** in `frontend/.env`. Compose defaults **`BACKEND_PORT`** to **5004** so host **`npm start`** on **5002** can run while **`docker compose up -d postgres`** (or the full stack) is up—avoid setting **`BACKEND_PORT=5002`** in root `.env` unless you intentionally use only one API listener on that port.

## Docker MCP (Cursor)

The repo includes [`.cursor/mcp.json`](.cursor/mcp.json), which starts the [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) gateway (`docker mcp gateway run`) so Cursor can use MCP servers you enable in Docker Desktop (**MCP Toolkit** → catalog, e.g. Playwright). Requires **Docker Desktop** 4.62+ with the toolkit available.

To (re)attach Cursor from the CLI (writes/updates project MCP config):

```bash
docker mcp client connect cursor
```

Restart Cursor after MCP changes. If **Cursor Settings → MCP** shows a broken Docker-related server alongside **`MCP_DOCKER`**, remove the duplicate so Cursor only runs one gateway, and ensure **`docker`** is on the `PATH` for GUI-launched Cursor.

## Backend On Existing Server

If you are uploading just the backend to the same server that already runs PostgreSQL and Nginx:

1. Copy `backend/.env.example` to `backend/.env`.
2. Set the real values for:
   - `PGPASSWORD`
   - `JWT_SECRET`
   - `PAYPAL_CLIENT_ID` if needed
3. Keep `PGHOST=127.0.0.1` and `PGSSLMODE=disable` when the backend and PostgreSQL run on the same machine.
4. Install backend dependencies and start the API from the `backend/` directory:

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
```

The S3 seeder stores:

- product image URLs in `products.images`
- original local file references in `products.local_images`
- bucket metadata in the product row and in `seed_manifest`

The current backend schema is aligned to the live PostgreSQL database that uses:

- `users._id`
- `products._id`
- `products.images` as `jsonb`
- `orders` and `order_items` created automatically on first backend start if they do not already exist
