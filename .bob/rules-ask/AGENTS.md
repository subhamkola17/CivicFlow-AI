# Ask Mode Context (Non-Obvious)

- **`backend/` and `frontend/` are fully independent** — no shared `package.json`, no workspace config, no symlinks
- **`recommendations` API uses the `Intervention` model** — searching for "recommendation" in models won't find it; look for `Intervention.js`
- **`Prediction.confidence` is not confidence** — it stores the ML model's R²-derived reliability score; the original field name is a legacy mismatch
- **Python ML is invoked at runtime** per HTTP request (not a running service) — it is spawned as a child process on every `POST /api/predictions/run`
- **`components.json`** makes it look like Tailwind is configured, but `RUN_LOCAL.md` explicitly says the frontend uses plain CSS; shadcn primitives are in `src/components/ui/` but Tailwind utility classes are available only through those components
- **No authentication middleware** on any backend route — JWT/bcryptjs are installed as dependencies but user auth is only partially wired (only `User` model exists; no auth route or middleware is registered in `server.js`)
- **Frontend API base URL is hardcoded** to `http://localhost:5000/api` in `src/lib/api.js` — there is no `.env` or Vite env variable for it
