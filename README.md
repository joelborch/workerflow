# WorkerFlow

WorkerFlow is an open-source automation control plane built for Cloudflare Workers.

It is designed for teams who want Zapier/Activepieces/Windmill-style automation capabilities while retaining full control of runtime, secrets, contracts, and deploy lifecycle.

## Current Release Scope

WorkerFlow `0.2.0` includes:

- Cloudflare worker-based orchestration core
- starter catalog (12 HTTP routes, 6 schedules)
- D1 idempotency/run/dead-letter model
- queue-backed async execution
- ops dashboard APIs with retry/replay support
- ingress hardening (token auth, HMAC, rate limiting)

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
```

Validate everything:

```bash
npm run release:check
```

## Repository Map

- `cloudflare/`: deployable runtime (workers, shared logic, scripts, contracts).
- `docs/`: architecture, roadmap, setup, and release docs.
- `infra/`: Cloudflare resource spec/schema.
- `packages/`: modular extraction targets (`core-runtime`, `handler-sdk`, recipes).

## Documentation

- [Cloudflare Runtime Guide](cloudflare/README.md)
- [Cloudflare Setup Runbook](docs/CLOUDFLARE_SETUP_RUNBOOK.md)
- [Architecture Notes](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Roadmap](docs/ROADMAP.md)
- [Release Process](docs/RELEASE_PROCESS.md)
- [Upgrade Guide](docs/UPGRADE_GUIDE.md)
- [Changelog](CHANGELOG.md)
