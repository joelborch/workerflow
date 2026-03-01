# WorkerFlow

Cloudflare-native automation orchestration you can self-host without paying recurring automation SaaS platform pricing.

WorkerFlow gives you Zapier/Activepieces-style workflow building blocks on Cloudflare Workers so you keep control of runtime, secrets, contracts, and deployment.

For many small-to-medium automation workloads, this can run on Cloudflare free-tier resources with no VPS and no always-on servers.

---

## Quick Links

| Link | Purpose |
| --- | --- |
| [Cloudflare Runtime Guide](cloudflare/README.md) | Runtime components and deploy commands |
| [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md) | End-to-end platform setup |
| [Starter Walkthrough](docs/STARTER_WALKTHROUGH.md) | First deploy + first workflow call with screenshots |
| [OpenAPI SDK Example](docs/OPENAPI_SDK_EXAMPLE.md) | Generate and use minimal TypeScript client from runtime OpenAPI |
| [Workflow Templates](docs/WORKFLOW_TEMPLATES.md) | Starter automation template gallery and usage |
| [Benchmarking Guide](docs/BENCHMARKING.md) | Generate route throughput + cost profile reports |
| [Agent Clone-To-Deploy Runbook](docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md) | Agent-first bootstrap/deploy flow |
| [Contributor Quickstart](docs/CONTRIBUTOR_QUICKSTART.md) | First OSS task workflow + label filters |
| [Agent Operating Guide](AGENTS.md) | Repository working agreement for coding agents |
| [Connector Model](docs/CONNECTOR_CATALOG.md) | Docs-first connector architecture and runtime mapping |
| [AI Connector Onramp](docs/AI_CONNECTOR_ONRAMP.md) | Exact file-by-file workflow for agent connector implementation |
| [Service API Index](docs/SERVICE_API_INDEX.md) | Official API doc links for agent connector implementation |
| [Connector Build Spec](docs/CONNECTOR_BUILD_SPEC.md) | Runtime connector contract, tests, and quality gates |
| [Agent Connector Playbook](docs/AGENT_CONNECTOR_PLAYBOOK.md) | Prompt/template workflow for agent-built connectors |
| [Starter Examples](examples/README.md) | Copy/paste automation starters |
| [Security Model](docs/SECURITY_MODEL.md) | Ingress auth, secret handling, RBAC |
| [Production Readiness Checklist](docs/PRODUCTION_READINESS_CHECKLIST.md) | Production rollout baseline |

## Why WorkerFlow

- avoid per-seat/per-task recurring automation SaaS pricing for internal workflows
- run on Cloudflare primitives instead of managing VM infrastructure
- keep execution logic, secrets, and deploy process in your own repository
- expose explicit route/schedule contracts so agents and contributors can safely extend the platform

## At A Glance (`0.2.0`)

| Area | Included |
| --- | --- |
| Runtime | 5-worker architecture (`api`, `workflow`, `queue-consumer`, `scheduler`, `ops-dashboard`) |
| Catalog | 21 HTTP routes + 6 schedules |
| Data model | D1 idempotency, run ledger, dead letters, replay metadata |
| Execution | queue-backed async + direct sync route execution |
| Security | token auth, HMAC signing, rate-limit options, dashboard RBAC |
| Connectors | docs-first index + executable runtime connector baseline |
| UI | Cloudflare Pages operations dashboard |

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
- [Environment and Secrets](cloudflare/docs/ENVIRONMENT.md)
- [Entrypoints Contract](docs/ENTRYPOINTS.md)
- [Brand Standard](docs/BRAND_STANDARD.md)

## Connectors

WorkerFlow now uses a docs-first connector model:

- [Connector Model](docs/CONNECTOR_CATALOG.md)
- [AI Connector Onramp](docs/AI_CONNECTOR_ONRAMP.md)
- [Service API Index](docs/SERVICE_API_INDEX.md)
- [Connector Build Spec](docs/CONNECTOR_BUILD_SPEC.md)
- [Agent Connector Playbook](docs/AGENT_CONNECTOR_PLAYBOOK.md)
- `cloudflare/connector-registry/services.json` (machine-readable service docs index)

## Repository Map

| Path | Description |
| --- | --- |
| `cloudflare/` | Deployable runtime, workers, shared contracts, scripts |
| `pages-dashboard/` | Cloudflare Pages dashboard frontend |
| `docs/` | Setup, architecture, security, release, roadmap, contribution docs |
| `packages/` | Extraction targets (`core-runtime`, `handler-sdk`, recipes) |
| `examples/` | Copy/paste starter automation examples |

## Full Documentation Index

- [Cloudflare Runtime Guide](cloudflare/README.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Starter Walkthrough](docs/STARTER_WALKTHROUGH.md)
- [OpenAPI SDK Example](docs/OPENAPI_SDK_EXAMPLE.md)
- [Workflow Templates](docs/WORKFLOW_TEMPLATES.md)
- [Benchmarking Guide](docs/BENCHMARKING.md)
- [Latest Benchmark Cost Profile](docs/BENCHMARK_COST_PROFILE.md)
- [Agent Clone-To-Deploy Runbook](docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md)
- [Contributor Quickstart](docs/CONTRIBUTOR_QUICKSTART.md)
- [Architecture Notes](docs/ARCHITECTURE.md)
- [Entrypoints](docs/ENTRYPOINTS.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Connector Model](docs/CONNECTOR_CATALOG.md)
- [AI Connector Onramp](docs/AI_CONNECTOR_ONRAMP.md)
- [Service API Index](docs/SERVICE_API_INDEX.md)
- [Connector Build Spec](docs/CONNECTOR_BUILD_SPEC.md)
- [Agent Connector Playbook](docs/AGENT_CONNECTOR_PLAYBOOK.md)
- [API and Contract Versioning Policy](docs/VERSIONING_POLICY.md)
- [Production Readiness Checklist](docs/PRODUCTION_READINESS_CHECKLIST.md)
- [Brand Standard](docs/BRAND_STANDARD.md)
- [Roadmap](docs/ROADMAP.md)
- [Next 10 OSS Issues](docs/NEXT_10_ISSUES.md)
- [Release Process](docs/RELEASE_PROCESS.md)
- [Canary Deploy Runbook](docs/CANARY_DEPLOY_RUNBOOK.md)
- [Migration Rollback Runbook](docs/MIGRATION_ROLLBACK_RUNBOOK.md)
- [Upgrade Guide](docs/UPGRADE_GUIDE.md)
- [Changelog](CHANGELOG.md)
