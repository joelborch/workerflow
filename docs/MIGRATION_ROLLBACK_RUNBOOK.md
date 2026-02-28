# Migration Guard And Rollback Runbook

This runbook defines the migration safety checks and rollback path for WorkerFlow D1 schema changes.

## Guard Commands

From `cloudflare/`:

- warn mode: `npm run migrations:guard`
- fail mode: `npm run migrations:guard:strict`

`migrations:guard:strict` checks:

- migration filename format (`0001_name.sql`)
- sequence continuity (no numbering gaps)
- `migrations/d1/APPLIED_THROUGH` pointer validity
- unapplied migration files newer than `APPLIED_THROUGH`
- risky SQL patterns (`DROP TABLE`, `DROP COLUMN`, table rename, unique-index adds, broad `DELETE FROM`)

CI gate:

- `.github/workflows/cloudflare-typecheck.yml` runs `npm run migrations:guard:strict`

## Normal Migration Rollout

1. add migration SQL file
2. run:
   - `cd cloudflare`
   - `npm ci`
   - `npm run migrations:guard:strict`
3. apply in staging/private env:
   - `npx wrangler d1 migrations apply <d1-name> --remote`
4. verify runtime + dashboard health checks
5. update `cloudflare/migrations/d1/APPLIED_THROUGH` to newest applied migration
6. merge + deploy

## Rollback Procedure

If deployment or migration fails:

1. halt rollout
2. redeploy previous known-good git tag
3. if migration introduced additive columns/tables only:
   - keep schema forward
   - rollback application code only
4. if destructive change was introduced:
   - restore from latest D1 backup/export snapshot
   - re-apply known-good migrations set
5. run post-rollback checks:
   - `/api/health`
   - `/api/ops/summary`
   - `/api/ops/runs?limit=20`
6. capture incident notes and create follow-up issue before retrying migration
