# Plan Mode Architectural Context (Non-Obvious)

## Structural constraints
- Backend and frontend have no shared build pipeline — any monorepo tooling (workspaces, Turborepo, etc.) must be added from scratch
- No test framework exists in either package — any testing plan requires adding a framework first
- Express 5 is in use (`^5.1.0`) — async error propagation behavior differs from Express 4 (unhandled promise rejections in routes are forwarded to the error handler automatically)

## ML pipeline constraint
- The RandomForest model is trained on a **hardcoded 40-row dataset** in `train_model.py` — predictions are only reliable within those data ranges; the model is not connected to live MongoDB data
- The 60-minute prediction is computed by feeding the 30-minute prediction back into the same model (recursive single-step), not a separate model
- Retraining produces a new `.pkl` file and requires a server restart to take effect

## Auth gap
- `bcryptjs` and `jsonwebtoken` are installed; a `User` model exists — but no `/api/auth` route is registered and no middleware protects any endpoint. Planning auth means registering routes in `server.js` and adding middleware per-route or globally

## Bottleneck algorithm
- Bottleneck is identified purely as the counter with the lowest `staffCount / processingTime` ratio — no queue-length weighting; severity thresholds are hardcoded (≥40 critical, ≥20 warning) in `bottleneckRoutes.js`

## Simulation route
- `POST /api/simulation` exists but its implementation should be verified before building on it; it is the least-documented route
