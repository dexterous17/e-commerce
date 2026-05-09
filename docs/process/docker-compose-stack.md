# Chat: Docker Compose full stack

**You:** What does `docker compose up --build` give me?

**Guide:** Postgres, the Node backend, an Nginx-hosted production build of the frontend, optional Portainer, Nginx Proxy Manager, and a one-shot `npm-bootstrap` helper for NPM proxy definitions. Ports follow repo-root `.env` (copy from `env/docker/.env.example`). Typical defaults: frontend **3000**, backend exposed as **BACKEND_PORT** (often **5004**).

---

**You:** The backend container listens on which port internally?

**Guide:** Inside the Docker network the API listens on **5000**. The **host** maps `BACKEND_PORT` → 5000. Nginx (frontend container) proxies `/api` and `/uploads` to the `backend` service; you normally browse **3000**, not the raw API port.

---

**You:** It fails on startup complaining about JWT.

**Guide:** Create `secrets/jwt_secret.txt` with a strong secret (never commit it):

```bash
openssl rand -hex 32 > secrets/jwt_secret.txt
```

Compose wires this via Docker secrets patterns the backend already supports (`*_FILE` env vars).

---

**You:** How do private S3 product images work in Compose?

**Guide:** Populate `env/aws/.env` from `env/aws/.env.example` with IAM credentials that can read your bucket. Without valid AWS vars, `/api/media/s3` flows may return 403/500 — the app still runs, but images break.

---

**You:** Can I mix Compose Postgres with a locally edited API on my Mac?

**Guide:** Often yes: run `docker compose up postgres` (or full stack minus conflicting ports), point `DATABASE_URL` in `backend/db/.env` at `localhost:5432` with the same user/password/db as Compose. Watch for port collisions between host backend and Compose backend.
