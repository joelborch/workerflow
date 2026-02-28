# API and Contract Versioning Policy

WorkerFlow uses semantic versioning (`MAJOR.MINOR.PATCH`) with explicit compatibility contracts for runtime routes and schedules.

## SemVer Rules

- `PATCH`: bug fixes, docs, and non-breaking implementation improvements
- `MINOR`: additive changes (new routes/schedules/connectors, optional fields)
- `MAJOR`: breaking route/schedule contract changes or behavior changes requiring consumer updates

## Route/Schedule Contract Policy

Source of truth:

- `cloudflare/shared/routes.ts`
- `cloudflare/shared/schedules.ts`

Compatibility contracts:

- `cloudflare/contracts/routes.v1.json`
- `cloudflare/contracts/schedules.v1.json`

Rules:

1. Additive route/schedule changes are allowed in minor versions.
2. Removing or renaming route/schedule IDs is a breaking change.
3. Any intentional breaking change must update:
   - contract JSON files
   - `docs/UPGRADE_GUIDE.md`
   - release notes/changelog

## Connector Contract Policy

Connector definitions are currently scaffolded metadata in:

- `cloudflare/workers/workflow/src/connectors/community/definitions/`

Rules:

1. Adding new connector definitions is non-breaking.
2. Renaming connector IDs is breaking for consumers and docs.
3. Removing required secrets from a connector is non-breaking; adding required secrets is potentially breaking and should be release-noted.

## Runtime Endpoint Stability

Stable core endpoint shape:

- `POST /api/{route_id}`
- `POST /api/dev/cron/{schedule_id}`
- `/api/ops/*` operational endpoints

Behavioral regressions to these paths require upgrade guidance and tests.

## Enforcement

CI checks:

- `npm run test:compat-contract`
- `npm run release:check`

Contributors should treat contract diffs as release-level changes, not incidental edits.
