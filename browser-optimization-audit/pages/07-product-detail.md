# Route: `/products/1` (example id)

- **Title (before fix):** `undefined size undefined` — caused by Meta + empty product on first paint (see SUMMARY).
- **Network:** `GET /api/products/1` → **500**
- **Snapshot:** Error message heading showed DB-oriented text (`column "id" does not exist` in this environment).
- **Notes:** Confirms API failure and need for DB/schema alignment. **Frontend fix** shipped in `ProductScreen.jsx` + `productReducers.jsx` (rebuild/redeploy the static bundle — e.g. Docker `frontend` image — to see it on port 3000).
