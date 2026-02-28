# Runtime Entrypoints

This document defines canonical route and schedule IDs for the default WorkerFlow runtime manifest.

## HTTP Routes

- `webhook_echo`
- `chat_notify`
- `lead_normalizer`

## Cron Schedules

- `heartbeat_hourly`
- `cleanup_daily`

## Path Contracts

- Invoke route: `POST /api/{route_id}`
- Manual schedule enqueue: `POST /api/dev/cron/{schedule_id}`
- API health: `GET /api/health`
- Workflow health: `GET /health`
- Workflow config health: `GET /health/config`

## Extension Guidance

When adding routes/schedules:

1. update `cloudflare/shared/routes.ts` and/or `cloudflare/shared/schedules.ts`
2. update compatibility contracts in `cloudflare/contracts/*.v1.json`
3. extend fixture tests in `cloudflare/scripts/*fixtures*.ts`
4. document new IDs here
