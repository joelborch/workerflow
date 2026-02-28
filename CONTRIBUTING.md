# Contributing

Thanks for contributing to WorkerFlow, a Cloudflare-native automation runtime.

For first-time contributors, start with:

- `docs/CONTRIBUTOR_QUICKSTART.md`

## Development Setup

1. install runtime dependencies:
   - `cd cloudflare && npm install`
2. run preflight checks:
   - `cd cloudflare && npm run preflight`
3. for dashboard changes, install dashboard dependencies:
   - `cd pages-dashboard && npm install`

## Before Opening a PR

Run runtime quality gates:

```bash
cd cloudflare
npm run release:check
```

For dashboard changes, also run:

```bash
cd pages-dashboard
npm run release:check
```

## Pull Request Guidelines

- keep changes scoped and focused
- avoid unrelated refactors in the same PR
- add or update tests for behavior changes
- link the related issue in PR description (`Closes #...`)
- run `npm run migrations:guard:strict` in `cloudflare/` for migration safety changes
- document new environment variables in `cloudflare/docs/ENVIRONMENT.md`
- align new docs language with `docs/BRAND_STANDARD.md`

## Breaking Changes

If a change intentionally breaks route or schedule compatibility:

1. update `cloudflare/contracts/routes.v1.json` and/or `cloudflare/contracts/schedules.v1.json`
2. call out the breaking change explicitly in the PR description
3. update `docs/UPGRADE_GUIDE.md`
