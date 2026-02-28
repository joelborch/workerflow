# WorkerFlow

WorkerFlow is an automation runtime for Cloudflare that gives you Zapier/Windmill/Activepieces-style orchestration with first-class control over infrastructure, secrets, and reliability.

## What WorkerFlow Gives You

- Edge-safe webhook ingress with sync and async execution modes.
- Queue-backed orchestration for durable background jobs.
- D1-backed idempotency, run ledgering, dead letters, and replay workflows.
- Cron scheduling with explicit enqueue semantics.
- Ops dashboard APIs for visibility and incident operations.
- Config-driven route/schedule manifests for modular deployments.

## Architecture

```text
Callers/Webhooks
      |
      v
 workers/api  ---> workers/workflow (/run-sync)
      |
      v
Cloudflare Queue
      |
      v
workers/queue-consumer ---> workers/workflow
      |
      v
      D1

workers/scheduler -> scheduled enqueue
workers/ops-dashboard -> ops APIs + UI
```

## Repository Layout

- `cloudflare/`: worker runtime, migrations, scripts, contracts, schemas.
- `packages/`: modular package scaffolding (`handler-sdk`, recipes, core runtime).
- `docs/`: setup runbooks, entrypoints, and operator docs.
- `infra/`: machine-readable Cloudflare resource specs and schema.

## Quick Start

```bash
cd cloudflare
npm install
npm run preflight
npm run bootstrap
```

Run validation suite:

```bash
npm run test:compat-contract
npm run test:manifest-mode
npm run test:schedule-fixtures
npm run test:runtime-config
npm run test:route-fixtures
npm run test:handler-fixtures
npm run typecheck
```

## Local Development

```bash
npm run dev:workflow
npm run dev:queue
npm run dev:api
npm run dev:scheduler
npm run dev:ops
```

## Docs

- [Cloudflare Runtime Guide](cloudflare/README.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Entrypoints](docs/ENTRYPOINTS.md)
- [LLM Quickstart](docs/llms.txt)
- [Public Export Checklist](docs/PUBLIC_EXPORT_CHECKLIST.md)

## Status

This repository is currently kept private while final cleanup and review complete.
