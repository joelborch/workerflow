# WorkerFlow Cloudflare Runtime

This directory contains the Cloudflare-native runtime that powers WorkerFlow.

## Runtime Model

- `workers/api`: ingress, auth, route lookup, idempotency, sync/async branching.
- `workers/queue-consumer`: asynchronous queue execution loop.
- `workers/workflow`: task dispatch and handler execution.
- `workers/scheduler`: cron trigger producer.
- `workers/ops-dashboard`: ops APIs + dashboard UI.
- `shared/`: cross-worker contracts and helpers.
- `migrations/d1/`: persistent schema evolution.

## What You Get Out Of The Box

- API ingress with deterministic route contracts.
- Queue and scheduler orchestration.
- Dead-letter and replay support.
- Route/schedule compatibility contracts.
- Manifest mode (`legacy` or `config`) with JSON schemas.
- Bootstrap planning/apply scripts for infra setup.

## Install And Validate

```bash
cd cloudflare
npm install
npm run preflight
npm run typecheck
```

## Validation Suite

```bash
npm run test:compat-contract
npm run test:manifest-mode
npm run test:schedule-fixtures
npm run test:runtime-config
npm run test:route-fixtures
npm run test:handler-fixtures
```

## Local Development

```bash
npm run dev:workflow
npm run dev:queue
npm run dev:api
npm run dev:scheduler
npm run dev:ops
```

## Infra Bootstrap

```bash
npm run bootstrap
npm run bootstrap:apply
```

`bootstrap` prints a machine-readable plan from `../infra/cloudflare.resources.json`.

## Deployment

```bash
npm run preflight:strict
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
npm run deploy:ops
```

## Key References

- Setup checklist: [docs/SETUP.md](docs/SETUP.md)
- Secrets/env: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- Ops API: [docs/OPS_DASHBOARD_API.md](docs/OPS_DASHBOARD_API.md)
- OpenAPI: [openapi.json](openapi.json)
- Route schema: [schemas/routes.config.schema.json](schemas/routes.config.schema.json)
- Schedule schema: [schemas/schedules.config.schema.json](schemas/schedules.config.schema.json)
