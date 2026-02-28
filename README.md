# WorkerFlow

Cloudflare-native automation orchestration you can self-host without paying SaaS automation platform pricing.

WorkerFlow gives you Zapier/Activepieces-style building blocks on Cloudflare Workers so you can keep control of runtime, secrets, and deployment.

For many small-to-medium automation workloads, this can run on Cloudflare free-tier resources with no VPS and no always-on servers.

## Why WorkerFlow

- avoid recurring per-task/per-seat automation SaaS pricing for core internal workflows
- run on Cloudflare primitives instead of managing VM infrastructure
- keep execution logic, secrets, and deployment in your own repository
- expose a clear contract for routes/schedules so agents and contributors can reason about the system

## Current Scope (`0.2.0`)

- 5-worker Cloudflare runtime (`api`, `workflow`, `queue-consumer`, `scheduler`, `ops-dashboard`)
- starter catalog with `12` HTTP routes and `6` schedules
- D1 idempotency + run ledger + dead-letter model
- queue-backed async execution with replay/retry surfaces
- ingress hardening (token auth, HMAC, rate-limit options)
- community connector catalog with `30` scaffolded connector definitions
- Cloudflare Pages dashboard for operational visibility

## Cost Profile

WorkerFlow is designed for cost-efficient operation on Cloudflare services.

- no required VPS/containers for the core runtime
- bursty automation traffic maps well to event-driven workers
- low-volume and internal automation use-cases are often viable on free-tier quotas

Important: Cloudflare plan limits and pricing can change. Validate expected request volume, CPU usage, and retention needs against your own account limits before production rollout.

## Architecture

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
npm run init
npm run preflight
npm run bootstrap
npm run release:check
```

## LLM + Agent Friendly Setup

WorkerFlow is documented so coding agents can bootstrap and deploy it end-to-end.

- [Agent Clone-To-Deploy Runbook](docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Environment and Secrets](cloudflare/docs/ENVIRONMENT.md)
- [Entrypoints Contract](docs/ENTRYPOINTS.md)

## Connectors

Community connector scaffolds live in:

- `cloudflare/workers/workflow/src/connectors/community/definitions/`

Catalog and contributor guidance:

- [Community Connector Catalog](docs/CONNECTOR_CATALOG.md)

## Repository Map

- `cloudflare/`: deployable runtime, workers, shared contracts, scripts
- `pages-dashboard/`: Cloudflare Pages dashboard app
- `docs/`: architecture, setup, security, release, roadmap
- `packages/`: modular extraction targets (`core-runtime`, `handler-sdk`, recipes)

## Documentation Index

- [Cloudflare Runtime Guide](cloudflare/README.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Agent Clone-To-Deploy Runbook](docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md)
- [Architecture Notes](docs/ARCHITECTURE.md)
- [Entrypoints](docs/ENTRYPOINTS.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Community Connector Catalog](docs/CONNECTOR_CATALOG.md)
- [Brand Standard](docs/BRAND_STANDARD.md)
- [Roadmap](docs/ROADMAP.md)
- [Release Process](docs/RELEASE_PROCESS.md)
- [Upgrade Guide](docs/UPGRADE_GUIDE.md)
- [Changelog](CHANGELOG.md)
