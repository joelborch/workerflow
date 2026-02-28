# Canary Deploy Runbook

Use this runbook to deploy WorkerFlow with a canary-first gate before full rollout.

Workflow file:

- `.github/workflows/canary-deploy.yml`

## Required Repository Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Optional but recommended when dispatching:

- `canary_health_url` input: `https://<canary-worker>/api/health`
- `production_health_url` input: `https://<production-worker>/api/health`

## Manual Dispatch Modes

1. `canary-only`
2. `full-rollout`

`full-rollout` always runs canary first, then proceeds to full deploy only if canary stage succeeds.

## Execution Flow

1. runtime release checks (`cloudflare/npm run release:check`)
2. dashboard release checks (`pages-dashboard/npm run release:check`)
3. required deploy secret validation
4. canary API worker deploy (`wrangler deploy --name <canary_worker_name>`)
5. optional canary health URL probe
6. optional full rollout deploy in safe order:
   - workflow
   - queue consumer
   - api
   - scheduler
   - ops dashboard
7. optional production health URL probe

## Rollback

If canary or rollout fails:

1. stop rollout immediately (do not re-run `full-rollout` until fixed)
2. redeploy previous known-good tag:
   - `git checkout <known-good-tag>`
   - `cd cloudflare && npm ci && npm run release:check`
   - redeploy workers in standard order
3. verify health endpoint and ops summary endpoints before reopening rollout

Use `docs/MIGRATION_ROLLBACK_RUNBOOK.md` if migration-related changes are part of the failure.
