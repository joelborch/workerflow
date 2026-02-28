# WorkerFlow

WorkerFlow is an open-source automation control plane built for Cloudflare Workers.

If you like the flexibility of Zapier/Activepieces/Windmill but want your own runtime, your own data boundaries, and your own deployment pipeline, this project is built for that model.

## Why WorkerFlow

- Own the runtime: deploy on your Cloudflare account, not someone else's control plane.
- Own reliability: explicit queue execution, dead letters, replay paths, and idempotency.
- Own contracts: route/schedule manifests and compatibility tests are first-class.
- Own extensibility: plug in handlers, connectors, and recipe packs.

## Core Capabilities

- HTTP route ingress with sync and async modes.
- Queue-backed task processing.
- Scheduled execution via cron.
- D1 state for runs, idempotency, cursors, and dead letters.
- Ops dashboard APIs for observability and retry operations.
- Config-driven manifest mode for modular deployments.

## System Architecture

```text
Callers / Webhooks
       |
       v
  workers/api --------------> workers/workflow (/run-sync)
       |
       v
Cloudflare Queue
       |
       v
workers/queue-consumer -----> workers/workflow
       |
       v
        D1

workers/scheduler -----------> Queue
workers/ops-dashboard -------> D1 + Queue APIs
```

## Quick Start

```bash
cd cloudflare
npm install
npm run preflight
npm run bootstrap
```

Run core checks:

```bash
npm run test:compat-contract
npm run test:manifest-mode
npm run test:schedule-fixtures
npm run test:runtime-config
npm run test:route-fixtures
npm run test:handler-fixtures
npm run typecheck
```

Run local workers:

```bash
npm run dev:workflow
npm run dev:queue
npm run dev:api
npm run dev:scheduler
npm run dev:ops
```

## Repository Map

- `cloudflare/`: deployable runtime (workers, shared logic, scripts, contracts).
- `docs/`: setup runbooks and platform docs.
- `infra/`: Cloudflare resource spec/schema.
- `packages/`: modular extraction targets (`core-runtime`, `handler-sdk`, recipes).

## Documentation

- [Cloudflare Runtime Guide](cloudflare/README.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Architecture Notes](docs/ARCHITECTURE.md)
- [Entrypoints](docs/ENTRYPOINTS.md)
- [LLM Quickstart](docs/llms.txt)
- [Public Export Checklist](docs/PUBLIC_EXPORT_CHECKLIST.md)

## Project Stage

WorkerFlow is in active foundation stage: runtime primitives are stable, while package extraction and broader connector/recipe ecosystem are still being expanded.
