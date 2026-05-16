# Chat: Docker Compose full stack

**You:** What does `docker compose up --build` give me?

**Guide:** Postgres, the Node backend, an Nginx-hosted production build of the frontend, **MinIO** (S3-compatible, optional for local object storage), optional Portainer, Nginx Proxy Manager, and a one-shot `npm-bootstrap` helper for NPM proxy definitions. Ports follow repo-root `.env` (copy from `env/docker/.env.example`). Typical defaults: frontend **3000**, backend exposed as **BACKEND_PORT** (often **5004**), MinIO API **9010** / console **9011**.

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

---

**You:** How do I copy production data into the local Compose Postgres?

**Guide:** Start Postgres (`docker compose up -d postgres`), install client tools (`pg_dump` / `pg_restore`), then run `./scripts/clone-production-db-to-docker.sh` with `PRODUCTION_DATABASE_URL` set. Dumps are written under `db-backups/` (gitignored). After restore, run `npm run db:validate-schema` from the repo root to confirm tables, keys, indexes, and FKs match the app.

---

**You:** How do I verify the database schema matches this codebase?

**Guide:** With `DATABASE_URL` pointing at the DB, run `npm run db:validate-schema` (default mode allows production-style `uuid` / `jsonb` / `numeric` where the Node layer treats them like the TEXT/DOUBLE types in `backend/db/schema.js`). For an exact match to `schema.js` DDL, run `npm run db:validate-schema:strict` (useful right after `initializeDatabase` on a fresh volume).

---

**You:** What is MinIO in this repo and how do I push local objects to AWS S3?

**Guide:** **MinIO is local-only** (S3-compatible) on **127.0.0.1:9010** (API) and **9011** (console; defaults avoid colliding with Portainer on 9000). **Your real bucket lives in AWS** — create it yourself and put region, bucket name, public URL, and IAM keys in `env/aws/.env`. The one-shot **minio-init** job creates a bucket **on MinIO only**, using the same `AWS_S3_BUCKET_NAME` / `AWS_S3_PREFIX` as in that file so object keys line up. For day-to-day local API/uploads, point the backend at MinIO with `AWS_S3_ENDPOINT_URL=http://minio:9000` and `AWS_S3_FORCE_PATH_STYLE=true`, and set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` to your MinIO root credentials. When you are ready to publish objects to AWS, run `./scripts/sync-minio-to-s3.sh` (it uploads into the **existing** AWS bucket; `--dry-run` first). Reverse sync (AWS → MinIO) is the same idea with `mc mirror` arguments swapped.
