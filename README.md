# Docker Setup

This repository now runs with separate Docker containers for:

- `frontend`: Nginx serving the Vite build and proxying `/api` and `/uploads`
- `backend`: Node/Express API
- `postgres`: PostgreSQL database

## Start

```bash
docker compose up --build
```

The app is available at `http://localhost:3000` by default.
The API is available at `http://localhost:5000`.

## Secrets

Docker Compose reads secrets from:

- `secrets/postgres_password.txt`
- `secrets/jwt_secret.txt`

Optional non-secret configuration lives in `.env`. A template is provided at `.env.example`.

The backend also supports Docker's standard `*_FILE` pattern, so additional values such as `PAYPAL_CLIENT_ID_FILE`, `AWS_ACCESS_KEY_ID_FILE`, or `AWS_SECRET_ACCESS_KEY_FILE` can be wired in the same way if needed.

If you need a custom Postgres CA certificate, mount it into the backend container and point `PGSSLROOTCERT` or `PGSSLROOTCERT_PATH` at that file.

## Backend on your machine (Postgres in Docker)

To run `npm start` inside `backend/` while Postgres runs in Compose:

1. From the repo root, start only the database: `docker compose up -d postgres`
2. Ensure `backend/.env` uses `PGHOST=127.0.0.1`, `PGPORT=5432`, and the same `PGUSER` / `PGPASSWORD` as Compose (defaults: user `ecommerce`, password in `secrets/postgres_password.txt`).
3. `cd backend && npm start`

The `postgres` service publishes `127.0.0.1:5432` so the host can connect.

On macOS, **AirPlay Receiver** commonly listens on **5000** and answers HTTP with **403**, so local **`npm start`** defaults to **5001** and Vite’s dev proxy targets **`http://localhost:5001`** unless you set **`DEV_PROXY_TARGET`**. If you run the API on another port (for example the Compose backend mapped to the host), set **`PORT`** in `backend/.env` and matching **`DEV_PROXY_TARGET`** in `frontend/.env`.

### Port already in use (`EADDRINUSE`)

If **`npm start`** fails because the port is taken, another process is usually still bound there (often a previous **`npm start`**). Inspect listeners with `lsof -iTCP:5001 -sTCP:LISTEN` (replace `5001` with your `PORT`), stop that process, or run on a free port, for example `PORT=5002 npm start`, and point **`DEV_PROXY_TARGET`** in `frontend/.env` at the same URL. If you use full **`docker compose`** and set **`BACKEND_PORT`** in the root `.env` to the same host port as **`PORT`** in `backend/.env`, only one of host **`npm start`** or the Compose backend can bind that port—stop the Compose backend (`docker compose stop backend`) or use different ports.

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
