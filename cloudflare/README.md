# WorkerFlow Cloudflare Runtime

Headless Cloudflare-native automation runtime for WorkerFlow.

## Runtime Components

- `workers/api`: ingress policy, auth/signature checks, route gating, idempotency
- `workers/workflow`: route/schedule dispatch and handler execution
- `workers/queue-consumer`: async queue consumption and workflow invocation
- `workers/scheduler`: cron producer for scheduled jobs
- `workers/ops-dashboard`: headless run, dead-letter, replay, and operational JSON APIs
- `shared/`: route/schedule contracts and helper utilities
- `migrations/d1/`: D1 schema migrations

## Validation Gate

```bash
cd cloudflare
npm run release:check
```

## Key Docs

- [docs/SETUP.md](docs/SETUP.md)
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- [docs/OPS_DASHBOARD_API.md](docs/OPS_DASHBOARD_API.md)
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [../docs/CLOUDFLARE_SETUP_RUNBOOK.md](../docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [../docs/SECURITY_MODEL.md](../docs/SECURITY_MODEL.md)
- [../docs/CANARY_DEPLOY_RUNBOOK.md](../docs/CANARY_DEPLOY_RUNBOOK.md)
- [../docs/MIGRATION_ROLLBACK_RUNBOOK.md](../docs/MIGRATION_ROLLBACK_RUNBOOK.md)
