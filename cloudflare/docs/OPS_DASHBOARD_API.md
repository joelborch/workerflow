# Ops Dashboard API

Operational API surface for dashboards, runbooks, and agent-driven tooling.

All `/api/*` routes are token-protected when dashboard tokens are configured.

## Auth Modes

- single-token mode (backward compatible): `OPS_DASHBOARD_TOKEN`
- RBAC mode:
  - `OPS_DASHBOARD_READ_TOKEN` for GET/read endpoints
  - `OPS_DASHBOARD_WRITE_TOKEN` for POST/write endpoints

Auth headers:

- `Authorization: Bearer <token>`
- `x-dashboard-token: <token>`

## Core Endpoints

- `GET /health`
- `GET /api/summary`
- `GET /api/catalog`
- `GET /api/runs`
- `GET /api/run-detail/{traceId}`
- `GET /api/dead-letters`
- `POST /api/retry/{traceId}`
- `POST /api/replay/{traceId}`
- `GET /api/replays`
- `GET /api/route-detail/{routePath}`
- `GET /api/cron-detail/{scheduleId}`
- `POST /api/cron-run/{scheduleId}`
- `GET /api/templates`
- `GET /api/secrets-health`
- `GET /api/oauth-tokens`
- `POST /api/oauth-tokens/upsert`
- `GET /api/audit-events`

## Extension-Friendly Endpoints

- `GET /api/meta`
- `GET /api/extensions`

`/api/extensions` is driven by `OPS_DASHBOARD_EXTENSIONS_JSON`.

## Workspace Filter

The following read endpoints support `workspace` query filtering:

- `/api/summary`
- `/api/catalog`
- `/api/runs`
- `/api/dead-letters`
- `/api/timeline`
- `/api/timeline-detail`
- `/api/error-clusters`
