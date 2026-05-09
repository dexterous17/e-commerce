# Chat: Deployment on AWS Lightsail

**You:** How is Lightsail different from local Compose?

**Guide:** `docker-compose.lightsail.yml` is tailored for production: it **does not** ship an embedded Postgres service. You set `DATABASE_URL` to managed Postgres (Lightsail managed DB, RDS, etc.). You still bring JWT, PayPal, and AWS secrets the same conceptual way as local Compose.

---

**You:** What is the deployment entrypoint?

**Guide:** Run `./scripts/deploy-lightsail.sh` from your machine after env files and `secrets/jwt_secret.txt` are filled for production values. Read the script and README “Deployment (Lightsail)” section for prerequisites (SSH, registry, paths).

---

**You:** How do I get HTTPS?

**Guide:** Use `docker-compose.nginx-proxy-manager.yml` and configure Let’s Encrypt. Set `NPM_LETSENCRYPT_EMAIL` in `env/npm-bootstrap/.env`. The repo’s `npm-bootstrap` container can provision proxy hosts (documented domains in README: `ecommerce.harshildex.com` / `backend.ecommerce.harshildex.com` — replace with yours in config).

---

**You:** Production shows zero products but health is OK.

**Guide:** The database is probably empty. SSH to the instance and run the seed script from repo root, e.g. `./scripts/lightsail-seed-from-manifest.sh`, or use the backend npm seed commands documented under “Data Seeding” in the main README. Never commit private keys (`.pem`) or production secrets.

---

**You:** What about CORS and trusted proxies?

**Guide:** Behind NPM or another reverse proxy, set `CORS_ORIGIN` to your public site origin(s) and configure `TRUST_PROXY` / `TRUST_PROXY_HOPS` as described in `env/backend/.env.example` so Express honors `X-Forwarded-*` correctly for HTTPS links and rate limiting.
