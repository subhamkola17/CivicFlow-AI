# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Structure

Monorepo with two independent apps — each has its own `node_modules` and must be run separately:
- `backend/` — Node.js/Express API (CommonJS, `require`/`module.exports`)
- `frontend/` — React 19 + Vite (ES modules, `import`/`export`)

## Commands

All commands must be run from their respective subdirectory, **not** the repo root.

```bash
# Backend
cd backend && npm run dev      # nodemon (development)
cd backend && npm start        # node server.js (production)

# Frontend
cd frontend && npm run dev     # Vite dev server → http://localhost:5173
cd frontend && npm run build   # production build
cd frontend && npx eslint .    # lint (no lint script in package.json)
```

There are **no tests** in this project — no test framework is installed.

## Architecture

```
backend/server.js       ← Express entry point, registers all routes
backend/config/db.js    ← Mongoose connects via process.env.MONGO_URI
backend/models/         ← Mongoose schemas
backend/routes/         ← One file per API domain
backend/ml/             ← Python ML bridge (see below)

frontend/src/App.jsx    ← Monolithic component containing most of the UI
frontend/src/lib/api.js ← All fetch calls go through this module
frontend/src/components/civicflow/  ← Page-level components (Login, LiveQueues, Analytics, etc.)
frontend/src/components/ui/         ← shadcn/ui primitives
```

## Critical: Python ML Bridge

`POST /api/predictions/run` spawns `backend/ml/predict.py` as a child process via `child_process.spawn`. The script:
- Is invoked with `cwd` set to `backend/` (not `backend/ml/`), so it loads the model with the relative path `ml/queue_prediction_model.pkl`
- Reads JSON input from **stdin**, writes JSON result to **stdout**
- Requires `python` (not `python3`) on PATH plus `joblib`, `scikit-learn`
- The pre-trained model lives at `backend/ml/queue_prediction_model.pkl`; retrain with `cd backend && python ml/train_model.py`

## Key Non-Obvious Patterns

**Backend response shape** — all routes return `{ success: true/false, ... }`. Errors always include both `message` and `error` fields.

**`Prediction.confidence` stores ML reliability** — the field is named `confidence` in the schema but intentionally stores the model's R²-derived reliability score (not a fake static percentage). See comment in `backend/routes/predictionRoutes.js:272`.

**`Intervention` model backs `/api/recommendations`** — the route file is named `recommendationRoutes.js` but it imports and uses the `Intervention` Mongoose model.

**`approveRecommendation` requires `approvedBy`** — the frontend must pass `approvedBy` (a User `_id`) when calling `POST /recommendations/:id/approve`; backend returns 400 otherwise.

**Frontend API base URL is hardcoded** — `frontend/src/lib/api.js:1` has `http://localhost:5000/api`. No env variable.

**`@/` path alias** — configured in `jsconfig.json` but Vite has no explicit alias in `vite.config.js`; alias resolution works via jsconfig only (editor tooling). Use relative imports in actual code unless the alias is added to vite config.

**`components.json` declares shadcn** but the frontend's `RUN_LOCAL.md` explicitly notes it uses **plain CSS and React, not Tailwind**. The shadcn config exists for scaffolding `src/components/ui/` primitives only.

**`findByIdAndUpdate` uses `returnDocument: "after"`** (Mongoose 7+ option, equivalent of `new: true`) — do not use the older `{ new: true }` syntax when updating routes.

## Environment Variables

Backend requires a `.env` file in `backend/`:
```
MONGO_URI=<mongodb connection string>
PORT=5000   # optional, defaults to 5000
```
