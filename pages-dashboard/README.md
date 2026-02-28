# WorkerFlow Dashboard (Cloudflare Pages)

Production dashboard UI for WorkerFlow automation operations.

This app is a standalone Cloudflare Pages frontend that talks to the WorkerFlow ops API.

Default local API URL:

- `http://127.0.0.1:8787`

## What it shows

- 24h operational KPI snapshot (runs, fail rate, dead letters, in-flight)
- Run timeline chart
- Top route volume
- Recent run table
- Error clusters
- Dead letter queue view
- Flow reliability leaderboard

## Stack

- React + TypeScript + Vite
- React Query for data loading/caching
- Recharts for telemetry visualizations
- Vitest + Testing Library for tests
- ESLint + strict TS checks for guardrails
- Wrangler for Cloudflare Pages deployment

## Local setup

1. Install dependencies:
   - `npm install`
2. Configure env:
   - `cp .env.example .env.local`
   - Set `VITE_API_BASE_URL` to your ops API base URL
3. Start dev server:
   - `npm run dev`

## Quality gates

- Lint: `npm run lint`
- Tests: `npm run test`
- Typecheck: `npm run typecheck`
- Full release check: `npm run release:check`

## Deploy to Cloudflare Pages

1. Build and deploy:
   - `npm run deploy:pages`
2. This deploys `dist/` to Pages project:
   - `workerflow-dashboard`

## API contract

The dashboard expects these API routes on the backend:

- `GET /api/ops/summary`
- `GET /api/ops/timeline?bucket=hour`
- `GET /api/ops/catalog`
- `GET /api/ops/runs?limit=30`
- `GET /api/ops/dead-letters?limit=20`
- `GET /api/ops/error-clusters?limit=12`
- `GET /api/ops/timeline-detail?bucket=...&resolution=hour`
- `GET /api/ops/run-detail/:traceId`

If ops auth is enabled, provide `VITE_OPS_DASHBOARD_TOKEN` or set it in the dashboard token field.
