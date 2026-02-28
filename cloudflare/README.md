# WorkerFlow Cloudflare Runtime

This directory contains the Cloudflare-native runtime powering WorkerFlow.

## Runtime Components

- `workers/api`: ingress, auth, signature checks, route gating, idempotency.
- `workers/queue-consumer`: async task consumption and workflow invocation.
- `workers/workflow`: task dispatch to route/schedule handlers.
- `workers/scheduler`: cron producer.
- `workers/ops-dashboard`: run/dead-letter/replay APIs.
- `shared/`: contracts and helpers.
- `migrations/d1/`: D1 schema.

## Starter Catalog

Default manifest includes:

- 12 HTTP routes
- 6 schedules

See [../docs/ENTRYPOINTS.md](../docs/ENTRYPOINTS.md).

## Setup

```bash
cd cloudflare
npm install
npm run init
npm run preflight
npm run bootstrap
```

## Validation + Release Gate

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
