# Ops Dashboard API

All `/api/*` routes require dashboard auth when `OPS_DASHBOARD_TOKEN` is set.

## Core Endpoints

- `GET /health`
- `GET /api/summary`
- `GET /api/catalog`
- `GET /api/runs`
- `GET /api/run-detail/{traceId}`
- `GET /api/dead-letters`
- `POST /api/retry/{traceId}`
- `GET /api/replays`
- `GET /api/route-detail/{routePath}`
- `GET /api/cron-detail/{scheduleId}`
- `POST /api/cron-run/{scheduleId}`

## Extension-Friendly Endpoints

- `GET /api/meta`
  - Returns runtime metadata, manifest mode, and extension counts.
- `GET /api/extensions`
  - Returns extension descriptors configured via `OPS_DASHBOARD_EXTENSIONS_JSON`.

Example `OPS_DASHBOARD_EXTENSIONS_JSON`:

```json
[
  {
    "id": "crm-connector",
    "label": "CRM Connector",
    "description": "Adds CRM-oriented workflow templates",
    "docsUrl": "https://example.com/docs/crm"
  }
]
```
