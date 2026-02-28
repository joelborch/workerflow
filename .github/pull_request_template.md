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

## Contracts / Breaking Changes

- [ ] No route/schedule contract change
- [ ] Route/schedule contract updated intentionally
- [ ] `docs/UPGRADE_GUIDE.md` updated (if breaking)

## Security / Public Export Checks

- [ ] No secrets, private domains, or account IDs committed
- [ ] Public-safe placeholders preserved (`REPLACE_WITH_*`)
- [ ] Docs updated if env vars or deployment behavior changed
