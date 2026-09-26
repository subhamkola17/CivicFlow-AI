# Agent Coding Rules (Non-Obvious)

## Backend (CommonJS only)
- Use `require`/`module.exports` — **never** `import`/`export` in `backend/`
- All route handlers follow `{ success: true/false, message, error }` response shape — keep this consistent
- MongoDB updates must use `{ returnDocument: "after" }`, not `{ new: true }`

## Frontend (ES modules only)
- All API calls go through `frontend/src/lib/api.js` via the shared `request()` helper — do not use `fetch` directly in components
- Path alias `@/` maps to `frontend/src/` but is **not** registered in `vite.config.js` — it only works in editor tooling. Add the alias to `vite.config.js` before using it in new imports
- `cn()` utility is in `frontend/src/lib/utils.js` (clsx + tailwind-merge)
- Most UI is inside the monolithic `frontend/src/App.jsx` — page-level components live in `frontend/src/components/civicflow/`

## ML Python bridge
- The `predict.py` script is called with `cwd = backend/` — file paths inside the script must be relative to `backend/`, not `backend/ml/`
- After changing training data or model logic, retrain: `cd backend && python ml/train_model.py`
- The `python` command must be on PATH (not `python3`)

## Naming gotchas
- The `Intervention` model is used by the recommendations API (file: `recommendationRoutes.js`, model: `Intervention`)
- `Prediction.confidence` stores the R²-derived reliability score, not a hand-crafted number
