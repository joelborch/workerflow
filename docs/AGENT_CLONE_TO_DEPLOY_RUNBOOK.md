# Agent Clone-To-Deploy Runbook

This runbook is written for coding agents operating in a terminal.

Goal: clone WorkerFlow, create Cloudflare resources, configure bindings/secrets, run checks, and deploy.

## 0. Inputs Agent Must Collect

- Cloudflare account ID
- Cloudflare auth via `wrangler login`
- desired project slug (example: `workerflow-runtime`)
- deployment mode:
  - `oss`: only generic/public routes and docs
  - `private-overlay`: internal routes/secrets layered on top in a separate private repo

## 1. Clone and Install

```bash
git clone https://github.com/joelborch/workerflow.git
cd workerflow/cloudflare
npm install
npm run doctor
npx wrangler login
```

## 2. Create Core Cloudflare Resources

Use WorkerFlow bootstrap or run manually:

```bash
npx wrangler d1 create <d1-name>
npx wrangler queues create <queue-name>
npx wrangler secrets-store create <store-name>
```

Workers are created on first successful deploy.

## 3. Fill `wrangler.jsonc` Placeholders

Agent must edit:

- `workers/api/wrangler.jsonc`
- `workers/workflow/wrangler.jsonc`
- `workers/queue-consumer/wrangler.jsonc`
- `workers/scheduler/wrangler.jsonc`
- `workers/ops-dashboard/wrangler.jsonc`

Required replacements:

- `account_id`
- `d1_databases[].database_id`
- queue names/bindings
- secrets store IDs
- service binding worker names

## 4. Apply D1 Migrations

```bash
npx wrangler d1 migrations apply <d1-name> --local
npx wrangler d1 migrations apply <d1-name> --remote
```

## 5. Set Required Secrets

Baseline:

```bash
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
```

Common optional secrets:

- `SLACK_WEBHOOK_URL`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `OPENAI_API_KEY`
- chat webhook URLs
- private overlay integration keys

## 6. Validate Before Deploy

```bash
npm run quickstart:5min
npm run migrations:guard:strict
npm run release:check
npm run smoke:handlers
npm run smoke:ops
```

If any command fails, stop and fix before deploy.

Rollback guidance:

- `docs/MIGRATION_ROLLBACK_RUNBOOK.md`

## 7. Deploy Order

```bash
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
npm run deploy:ops
```

## 8. Deploy Pages Dashboard

From `pages-dashboard/`:

```bash
npm install
npm run release:check
npx wrangler pages project create <pages-project-name> --production-branch main
npm run deploy:pages -- --commit-dirty=true
```

Set:

- `VITE_API_BASE_URL` to deployed API base URL.

## 9. Post-Deploy Verification

```bash
curl -sS <api-base>/api/health
curl -sS <api-base>/api/ops/summary
curl -sS "<api-base>/api/ops/timeline?bucket=hour&hours=24"
```

Dashboard checks:

- loads without `Failed to fetch`
- route/schedule catalog tables populate
- timeline and run-detail drilldowns respond

## 10. Reusable Agent Prompt

```text
Bootstrap this WorkerFlow repo on Cloudflare from scratch.
1) Create/confirm D1, queue, secrets store.
2) Fill wrangler bindings/placeholders.
3) Apply migrations.
4) Set required secrets (prompt me only when value is needed).
5) Run release checks and smoke tests.
6) Deploy workers in safe order.
7) Deploy pages dashboard and verify /api/ops endpoints.
Do not skip failing tests. Show every command and result summary.
```
