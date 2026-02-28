# Architecture Notes

## Core Components

- API Worker: ingress policy, auth/signature checks, idempotency, sync/async split.
- Queue Consumer: asynchronous execution adapter.
- Workflow Worker: route/schedule dispatch and handler execution.
- Scheduler Worker: cron-to-task producer.
- Ops Dashboard Worker: operational reads + retry/cron-run writes.
- D1: run ledger, idempotency keys, cursor state, dead letters, replay lineage.

## Execution Paths

HTTP route (async):

1. `POST /api/{route}`
2. API validates, checks auth/signature/rate limits
3. API writes idempotency marker
4. API enqueues `http_route` task
5. queue consumer invokes workflow
6. workflow executes handler and records run state

HTTP route (sync):

1. `POST /api/{route}`
2. API validates and forwards task to workflow `/run-sync`
3. workflow executes immediately and returns payload

Scheduled job:

1. scheduler cron tick
2. scheduler enqueues `scheduled_job`
3. queue consumer invokes workflow
4. workflow executes schedule handler

## Failure Model

- handler failures are persisted to dead letters
- replay APIs allow controlled reprocessing
- route/schedule enablement checks guard stale or disabled tasks

## Security Model Touchpoints

- ingress token + HMAC signature on API worker
- optional API rate limiting
- dashboard read/write token separation

## Multi-Tenant Strategy (Reference)

WorkerFlow is single-tenant by default.
For multi-tenant use-cases, introduce tenant partitioning at:

- ingress identity (`x-tenant-id` + signed claims)
- task payload metadata
- D1 query filters and run/dead-letter views
- per-tenant secret routing and policy checks
