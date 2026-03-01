## Summary

Describe what changed and why.

## Scope

- [ ] Runtime (`cloudflare/`)
- [ ] Dashboard (`pages-dashboard/`)
- [ ] Connectors
- [ ] Docs
- [ ] CI/CD

## Validation

- [ ] Linked issue(s) in PR description (`Closes #...`)
- [ ] `cd cloudflare && npm run migrations:guard:strict`
- [ ] `cd cloudflare && npm run release:check`
- [ ] `cd pages-dashboard && npm run release:check` (if dashboard changed)
- [ ] Added/updated tests for behavior changes
- [ ] Updated docs/runbooks for new operator workflows

## Connector Checklist (if connector-related)

- [ ] Added/updated route contract in `cloudflare/shared/routes.ts`
- [ ] Added/updated route docs in `docs/ENTRYPOINTS.md`
- [ ] Added/updated handler in `cloudflare/workers/workflow/src/handlers/http/`
- [ ] Added/updated connector primitive in `cloudflare/workers/workflow/src/connectors/`
- [ ] Added/updated secret requirements in `cloudflare/shared/connector_registry.ts`
- [ ] Added/updated `test_handler_fixtures.ts`
- [ ] Added/updated `test_connector_harness.ts`
- [ ] Added/updated service index docs (`docs/SERVICE_API_INDEX.md` and/or `cloudflare/connector-registry/services.json`)

## Contracts / Breaking Changes

- [ ] No route/schedule contract change
- [ ] Route/schedule contract updated intentionally
- [ ] `docs/UPGRADE_GUIDE.md` updated (if breaking)

## Security / Public Export Checks

- [ ] No secrets, private domains, or account IDs committed
- [ ] Public-safe placeholders preserved (`REPLACE_WITH_*`)
- [ ] Docs updated if env vars or deployment behavior changed
- [ ] Secret scan and dependency checks pass
