# WorkerFlow Dashboard (Cloudflare Pages)

Production dashboard UI for WorkerFlow operations.

This app is a standalone Cloudflare Pages frontend that talks to the WorkerFlow ops API.

Default local API URL:

- `http://127.0.0.1:8787`

## What It Shows

- 24h KPI snapshot (runs, fail rate, dead letters, in-flight)
- run timeline chart
- top route volume
- recent run table
- error clusters
- dead-letter queue view
- flow reliability leaderboard
- route and cron catalog

## Stack

- React + TypeScript + Vite
- React Query for data loading/caching
- Recharts for telemetry visualizations
- Vitest + Testing Library for tests
- ESLint + strict TS checks for guardrails
- Wrangler for Cloudflare Pages deployment

## Local Setup

1. install dependencies:
   - `npm install`
2. configure env:
   - `cp .env.example .env.local`
   - set `VITE_API_BASE_URL` to your ops API base URL
3. start dev server:
   - `npm run dev`

## Quality Gates

- lint: `npm run lint`
- tests: `npm run test`
- typecheck: `npm run typecheck`
- full release check: `npm run release:check`

## Deploy to Cloudflare Pages

1. build and deploy:
   - `npm run deploy:pages`
2. this deploys `dist/` to Pages project:
   - `workerflow-dashboard`

## API Contract

The dashboard expects these backend endpoints:

- `GET /api/ops/summary`
- `GET /api/ops/timeline?bucket=hour`
- `GET /api/ops/catalog`
- `GET /api/ops/runs?limit=30`
- `GET /api/ops/dead-letters?limit=20`
- `GET /api/ops/error-clusters?limit=12`
- `GET /api/ops/timeline-detail?bucket=...&resolution=hour`
- `GET /api/ops/run-detail/:traceId`

If ops auth is enabled, provide `VITE_OPS_DASHBOARD_TOKEN` or set it in the dashboard token field.
