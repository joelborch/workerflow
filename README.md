# WorkerFlow

[![Cloudflare CI](https://github.com/joelborch/workerflow/actions/workflows/cloudflare-typecheck.yml/badge.svg)](https://github.com/joelborch/workerflow/actions/workflows/cloudflare-typecheck.yml)
[![Secret Scan](https://github.com/joelborch/workerflow/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/joelborch/workerflow/actions/workflows/secret-scan.yml)
[![License](https://img.shields.io/github/license/joelborch/workerflow)](LICENSE)

Cloudflare-native headless automation orchestration you can self-host without paying recurring automation SaaS platform pricing.

WorkerFlow provides workflow-automation building blocks on Cloudflare Workers (`api`, `workflow`, `queue-consumer`, `scheduler`, and headless `ops-dashboard` APIs) with full control of runtime, secrets, contracts, and deployment.

## Try In 5 Minutes

```bash
cd cloudflare
npm install
npm run init
npm run doctor
npm run quickstart:5min
npm run release:check
```

## Quick Links

- [Cloudflare Runtime Guide](cloudflare/README.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Architecture Notes](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Canary Deploy Runbook](docs/CANARY_DEPLOY_RUNBOOK.md)
- [Migration Rollback Runbook](docs/MIGRATION_ROLLBACK_RUNBOOK.md)
- [Ops Dashboard API](cloudflare/docs/OPS_DASHBOARD_API.md)
- [Starter Examples](examples/README.md)
- [Agent Operating Guide](AGENTS.md)

## Repository Map

| Path | Description |
| --- | --- |
| `cloudflare/` | Deployable headless Workers runtime, shared contracts, migrations, tests, and scripts |
| `packages/` | Shared `core-runtime` extraction package |
| `docs/` | Core architecture, setup, security, canary, and rollback runbooks |
| `examples/` | Copy/paste starter automation examples |
| `infra/` | Cloudflare resource specification templates |
