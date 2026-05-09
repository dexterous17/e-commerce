# Chat: Local development

**You:** I cloned the repo. What is the fastest way to hack on the storefront with hot reload?

**Guide:** From the repo root, run `npm start` or `npm run dev:all`. That starts the Express API (default **5002**) and Vite (**5173**) together. Vite proxies `/api`, `/uploads`, and `/upload` to whatever you set as `DEV_PROXY_TARGET` — usually `http://localhost:5002`. Open `http://localhost:5173`.

---

**You:** Why 5002 and not 5000?

**Guide:** On macOS, AirPlay Receiver often binds **5000**, which leads to mysterious 403 responses. This project defaults the local API to **5002**. Docker Compose publishes the backend on **5004** by default so a container stack and local `npm start` can coexist without fighting for the same port.

---

**You:** I only want the React app; my API is already running.

**Guide:** From `frontend/`, use `npm run start:vite-only` (see `frontend/package.json`), or from root `npm run start:frontend` if your root scripts expose that alias. Ensure `DEV_PROXY_TARGET` matches where the API listens.

---

**You:** How do I know the API is healthy?

**Guide:**  
`curl -s http://127.0.0.1:5002/api/health`  

You should see JSON with `"ok": true`. Fields like `awsAccessKeyEnvSet` may be `false` locally if you are not using private S3 yet; that is fine for UI work.

---

**You:** Where do I put database connection settings?

**Guide:** Postgres is required. Either run only the `postgres` service from Compose, use a local install, or a hosted URI. Connection string goes in `backend/db/.env` as `DATABASE_URL`, or use `backend`’s env init helper: `cd backend && npm run env:init`, then edit the generated files following `env/backend/.env.example` and `backend/db/.env.example`.

---

**You:** I get `EADDRINUSE`.

**Guide:** Something else owns the port. For 5002: `lsof -iTCP:5002 -sTCP:LISTEN`, stop that process or set `PORT` in `env/backend/.env` and point `DEV_PROXY_TARGET` in `env/frontend/.env` at the same origin.
