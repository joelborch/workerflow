# Runtime Entrypoints

This document lists the canonical route and schedule IDs used by the Cloudflare runtime.

## HTTP Route IDs

- `webhook_echo`
- `chat_notify`
- `lead_normalizer`

## Cron Schedule IDs

- `heartbeat_hourly`
- `cleanup_daily`

## URL Patterns

- API route invocation: `POST /api/{route_id}`
- Manual cron enqueue (dev utility): `POST /api/dev/cron/{schedule_id}`
- API health: `GET /api/health`
- Workflow health: `GET /health`
- Workflow config health: `GET /health/config`
