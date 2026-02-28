# Contributing

## Development Setup

1. Install dependencies:
   - Root: `npm install`
   - Cloudflare runtime: `cd cloudflare && npm install`
2. Run preflight checks:
   - `npm run preflight`

## Before Opening a PR

Run the Cloudflare test suite:

```bash
cd cloudflare
npm run preflight
npm run test:compat-contract
npm run test:schedule-fixtures
npm run test:runtime-config
npm run test:route-fixtures
npm run test:handler-fixtures
```

## Pull Request Guidelines

- Keep changes scoped and focused.
- Avoid unrelated refactors in the same PR.
- Add or update tests for behavior changes.
- Document new environment variables in `cloudflare/docs/ENVIRONMENT.md`.

## Breaking Changes

If a change intentionally breaks route or schedule compatibility:

1. Update `cloudflare/contracts/routes.v1.json` and/or `cloudflare/contracts/schedules.v1.json`.
2. Call out the breaking change explicitly in the PR description.
