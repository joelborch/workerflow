# Contributing

Thanks for contributing to WorkerFlow, a headless Cloudflare-native automation runtime.

For setup and architecture details, start with:

- `README.md`
- `cloudflare/docs/SETUP.md`
- `docs/ARCHITECTURE.md`

## Development Setup

1. install runtime dependencies:
   - `cd cloudflare && npm install`
2. run preflight checks:
   - `cd cloudflare && npm run preflight`

## Before Opening a PR

Run runtime quality gates:

```bash
cd cloudflare
npm run release:check
```

## Pull Request Guidelines

- keep changes scoped and focused
- avoid unrelated refactors in the same PR
- add or update tests under `cloudflare/tests/` for behavior changes
- link the related issue in PR description (`Closes #...`)
- run `npm run migrations:guard:strict` in `cloudflare/` for migration safety changes
- document new environment variables in `cloudflare/docs/ENVIRONMENT.md`

## Breaking Changes

If a change intentionally breaks route or schedule compatibility:

1. update `cloudflare/contracts/routes.v1.json` and/or `cloudflare/contracts/schedules.v1.json`
2. call out the breaking change explicitly in the PR description and `CHANGELOG.md`
