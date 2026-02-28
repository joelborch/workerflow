# Cloudflare Runtime Status

Last updated: 2026-02-28

## Scope

This file tracks scaffold maturity for the Cloudflare runtime in this repository.
It intentionally omits account-specific identifiers and deployment versions so it is safe for open-source publication.

## Completed

- Runtime workers are implemented:
  - `workers/api`
  - `workers/queue-consumer`
  - `workers/scheduler`
  - `workers/workflow`
  - `workers/ops-dashboard`
- HTTP route and cron manifests are wired to workflow handlers.
- D1 migrations and queue wiring are in place.
- Preflight/typecheck checks are available and passing locally.
- Runtime config validation is available (`/health/config` in workflow).
- Dead-letter storage and replay lineage support are implemented.

## Resource Template

Wrangler configs use placeholders that you must replace for your account:

- `REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID`
- `REPLACE_WITH_D1_DATABASE_ID`
- `REPLACE_WITH_SECRETS_STORE_ID`

## Remaining Work (Template)

1. Provision Cloudflare resources (D1, Queue, Secrets Store).
2. Replace Wrangler placeholders with your resource identifiers.
3. Set all required secrets for enabled routes/schedules.
4. Run full smoke tests against your environment.
5. Perform route-by-route cutover from legacy webhook origins.
6. Confirm monitoring, alerting, and dead-letter replay operations.

## Notes

Current orchestration model is queue-driven:

`api -> queue -> queue-consumer -> workflow`

This is independent of Cloudflare Workflows engine primitives.
