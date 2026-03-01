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

Connector metadata and implementation contracts live in:

- `cloudflare/shared/connector_registry.ts`
- `cloudflare/connector-registry/services.json`
- `docs/CONNECTOR_BUILD_SPEC.md`
- `docs/SERVICE_API_INDEX.md`

Rules:

1. Adding a new connector to `services.json` is non-breaking.
2. Renaming runtime connector IDs or route IDs is breaking for dashboard/API consumers and should be release-noted.
3. Adding required secrets for an existing runtime route is potentially breaking and should be release-noted.
4. Replacing docs links for a connector is non-breaking if route contracts remain unchanged.

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
