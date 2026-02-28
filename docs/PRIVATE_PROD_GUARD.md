# Private Production Guard

This guard prevents private deploy pipelines from running with placeholder Cloudflare IDs.

## CI Workflow

Workflow file:

- `.github/workflows/private-deploy-guard.yml`

It only runs when repository variable `PRIVATE_DEPLOY_GUARD=true`.

## Enable In Private Repo

1. Go to repository settings.
2. Add Actions variable:
   - `PRIVATE_DEPLOY_GUARD`
   - Value: `true`

## Local Guard Commands

From `cloudflare/`:

- Warn mode: `npm run deploy:guard`
- Fail mode: `npm run deploy:guard:strict`

`deploy:guard:strict` checks:

- `workers/*/wrangler.jsonc`
- `../infra/cloudflare.resources.json`

and fails if any `REPLACE_WITH_*` placeholders remain.
