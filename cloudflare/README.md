# Cloudflare Migration Scaffold

This folder is the starting point for WorkerFlow automations on Cloudflare Workers.

## Layout

- `workers/api`: HTTP ingress (webhook routes, sync/async split)
- `workers/ops-dashboard`: lightweight ops dashboard + retry API on top of D1/Queue
- `workers/scheduler`: cron triggers that enqueue or invoke jobs
- `workers/queue-consumer`: async queue processor
- `workers/workflow`: orchestration endpoints and flow runner stubs
- `shared`: cross-worker helpers and route manifest
- `migrations/d1`: D1 schema migrations

## Prereqs

- Node.js 20+
- npm 10+
- Cloudflare account + Wrangler auth

## Install

```bash
cd cloudflare
npm install
```

## Local Commands

```bash
npm run typecheck
npm run preflight
npm run smoke:ops
npm run dev:api
npm run dev:ops
npm run dev:scheduler
npm run dev:queue
npm run dev:workflow
```

Bootstrap plan (machine-readable):

```bash
npm run bootstrap
```

## Deploy Commands

```bash
npm run preflight:strict
npm run deploy:api
npm run deploy:ops
npm run deploy:scheduler
npm run deploy:queue
npm run deploy:workflow
```

## What Is Included

- Starter bindings and env typing
- Route manifest generated from current runtime endpoints
- D1 schema for:
  - idempotency keys
  - run ledger
  - cursor state (`wmill.getVariable/setVariable` replacement)
  - dead letter records
- Example async ingress -> queue pattern
- Example cron -> queue pattern
- Ops dashboard APIs for run/dead-letter visibility + dead-letter retry enqueue

## What Still Needs Real Values

- Cloudflare account id and resource ids
- Required workflow secret: `GOOGLEAI_API_KEY` (set with `npx wrangler secret put <NAME> --config workers/workflow/wrangler.jsonc`)
- Recommended Google delegated auth secrets: `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_PRIVATE_KEY_PART1`, `GCP_PRIVATE_KEY_PART2`, `GOOGLE_ADMIN_USER`
- External service credentials (Google, ClickUp, Mailchimp, Zyte, Telegram)
- Optional custom domains and DNS cutover
- Optional dashboard access token (`OPS_DASHBOARD_TOKEN`) for `workers/ops-dashboard`

See env details: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)

Ops dashboard API details: [docs/OPS_DASHBOARD_API.md](docs/OPS_DASHBOARD_API.md)

Schemas:

- `schemas/routes.config.schema.json`
- `schemas/schedules.config.schema.json`
- `../infra/cloudflare.resources.schema.json`
