# Runtime Entrypoints

This document defines canonical route and schedule IDs for the default WorkerFlow runtime manifest.

## HTTP Routes

- `webhook_echo`
- `chat_notify`
- `lead_normalizer`
- `json_transform`
- `text_extract`
- `payload_hash`
- `template_render`
- `timestamp_enrich`
- `webhook_fanout`
- `incident_create`
- `health_note`
- `noop_ack`

## Cron Schedules

- `heartbeat_hourly`
- `cleanup_daily`
- `digest_daily`
- `retry_dead_letters_hourly`
- `usage_rollup_15m`
- `config_snapshot_daily`

## Path Contracts

- invoke route: `POST /api/{route_id}`
- manual schedule enqueue: `POST /api/dev/cron/{schedule_id}`
- API health: `GET /api/health`
- workflow health: `GET /health`
- workflow config health: `GET /health/config`

## Extension Guidance

When adding routes/schedules:

1. update `cloudflare/shared/routes.ts` and/or `cloudflare/shared/schedules.ts`
2. update compatibility contracts in `cloudflare/contracts/*.v1.json`
3. extend fixture tests in `cloudflare/scripts/*fixtures*.ts`
4. update docs here and changelog notes
