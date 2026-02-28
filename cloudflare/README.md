# WorkerFlow Cloudflare Runtime

Cloudflare-native automation runtime for WorkerFlow.

This directory contains the deployable workers, shared contracts, migration files, and runtime checks that power an event-driven automation platform without requiring a VPS.

## Runtime Components

- `workers/api`: ingress policy, auth/signature checks, route gating, idempotency
- `workers/workflow`: route/schedule dispatch and handler execution
- `workers/queue-consumer`: async queue consumption and workflow invocation
- `workers/scheduler`: cron producer for scheduled jobs
- `workers/ops-dashboard`: run/dead-letter/retry and operational APIs
- `shared/`: route/schedule contracts + helper utilities
- `migrations/d1/`: D1 schema migrations

## Starter Catalog

Default manifest includes:

- 21 HTTP routes
- 6 schedules

See [../docs/ENTRYPOINTS.md](../docs/ENTRYPOINTS.md).

## Local Setup

```bash
cd cloudflare
npm install
npm run init
npm run preflight
```

## Validation Gate

```bash
npm run release:check
```

## Local Development

```bash
npm run dev:workflow
npm run dev:queue
npm run dev:api
npm run dev:scheduler
npm run dev:ops
```

## Deploy

```bash
npm run preflight:strict
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
npm run deploy:ops
```

## Key Docs

- [docs/SETUP.md](docs/SETUP.md)
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- [docs/OPS_DASHBOARD_API.md](docs/OPS_DASHBOARD_API.md)
- [../docs/SECURITY_MODEL.md](../docs/SECURITY_MODEL.md)
- [../docs/RELEASE_PROCESS.md](../docs/RELEASE_PROCESS.md)
