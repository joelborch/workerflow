# AGENTS.md

This file defines how coding agents should work in this repository.

## Mission

Maintain and extend WorkerFlow as a headless, Cloudflare-native automation runtime that is safe for public OSS use, easy to deploy, and easy to verify.

## Repo Layout

- `cloudflare/`: headless runtime workers (`api`, `workflow`, `queue-consumer`, `scheduler`, `ops-dashboard`), contracts, migrations, tests, and deploy scripts
- `docs/`: core setup, architecture, security, canary, and rollback runbooks
- `packages/`: `core-runtime` shared primitives
- `infra/`: Cloudflare resource templates/spec

## Required Validation

```bash
cd cloudflare
npm run release:check
```

## Deploy Order (Cloudflare Runtime)

```bash
cd cloudflare
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
npm run deploy:ops
```

## Security And Public-Repo Guardrails

- Never commit real tokens, API keys, account IDs, database IDs, or private URLs.
- Keep public config files placeholder-based (`REPLACE_WITH_*`).
- Use `wrangler secret put` for sensitive values.
- Validate docs/examples do not include private domains or project-specific credentials.

## Private/Public Split Expectations

- Public repo: generic runtime/platform capabilities only.
- Private overlay repo: business-specific handlers, connectors, customer workflows.
- If moving changes from private to public, sanitize first and retain only reusable components.

## Production operation boundary

Local development, release checks, fixture tests, and builds may run without confirmation. Deploying any Worker or Pages project, applying remote migrations, changing production bindings, routes, or Cloudflare secrets, or running a production smoke test that mutates state requires an explicit request for that exact operation and fresh human approval.

Use the guarded `npm run deploy:*` commands for approved deployments. Do not bypass the repository's approval scripts with raw Wrangler commands. Keep public configs placeholder-based, keep credentials in Cloudflare secrets or ignored local files, and never let tests fall back to production services or data.
