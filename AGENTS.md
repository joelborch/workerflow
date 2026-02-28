# AGENTS.md

This file defines how coding agents should work in this repository.

## Mission

Maintain and extend WorkerFlow as a Cloudflare-native automation runtime that is safe for public OSS use, easy to deploy, and easy for other agents to operate.

## Repo Layout

- `cloudflare/`: runtime workers, contracts, migrations, deploy scripts
- `pages-dashboard/`: Cloudflare Pages dashboard frontend
- `docs/`: runbooks, architecture, security, release process
- `packages/`: extracted modules (`core-runtime`, `handler-sdk`, recipes)
- `infra/`: Cloudflare resource templates/spec

## Standard Agent Workflow

1. Read scope docs first:
   - `README.md`
   - `docs/ENTRYPOINTS.md`
   - `docs/SECURITY_MODEL.md`
2. Implement minimal safe change.
3. Run relevant quality gates.
4. Verify no public secret exposure.
5. Commit with focused message.

## Required Validation

### Runtime changes (`cloudflare/`)

```bash
cd cloudflare
npm run release:check
```

### Dashboard changes (`pages-dashboard/`)

```bash
cd pages-dashboard
npm run release:check
```

### Connector catalog changes

```bash
cd cloudflare
npm run test:connector-catalog
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
- Follow `docs/PUBLIC_EXPORT_CHECKLIST.md` before publishing any shared branch.

## Documentation Rules

- Keep language aligned with `docs/BRAND_STANDARD.md`.
- Keep setup commands copy/paste safe.
- Update docs in the same PR when behavior changes.

## Private/Public Split Expectations

- Public repo: generic runtime/platform capabilities only.
- Private overlay repo: business-specific handlers, connectors, customer workflows.
- If moving changes from private to public, sanitize first and retain only reusable components.

## Commit Conventions

Use clear prefixes:

- `feat:` new capability
- `fix:` behavior correction
- `docs:` documentation-only changes
- `chore:` maintenance/refactor/tooling

Prefer small, reviewable commits with explicit impact.
