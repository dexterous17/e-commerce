# Chat: Regenerating demo videos (Playwright)

**You:** Where do the storefront demo MP4s come from?

**Guide:** They are recorded by Playwright specs under `frontend/tests/demo-videos/`. The npm script `npm run test:e2e:demo-videos` runs the `demo-videos` project; Playwright writes `video.webm` under `frontend/test-results/`, then `frontend/scripts/sync_demo_mp4_from_results.py` transcodes stable filenames into `docs/demo-videos/*.mp4`. See `docs/demo-videos/REGENERATE.txt`.

---

**You:** What has to be true before I hit record?

**Guide:** The API must be healthy and the catalog needs at least one product with **`countInStock > 0`** so checkout demos can succeed. For the Vite workflow you need Postgres and a valid `DATABASE_URL` for the backend. **ffmpeg** must be on your PATH.

---

**You:** Give me copy-paste commands.

**Guide:** Typical full regeneration from `frontend/`:

```bash
cd frontend && npm run test:e2e:demo-videos
```

If **5173** is already running (you started Vite manually):

```bash
PW_REUSE_SERVER=1 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e:demo-videos
```

If you use **Docker Compose** static frontend on **3000** and API on host **5004** (adjust ports to match your `.env`):

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 E2E_API_ORIGIN=http://127.0.0.1:5004 npm run test:e2e:demo-videos
```

---

**You:** How do I embed a demo on GitHub?

**Guide:** Commit MP4s under `docs/demo-videos/` and `assets/` and push. The root README embeds each clip with an HTML `<video controls>` player (raw `githubusercontent.com` URLs). See `docs/demo-videos/REGENERATE.txt`.
