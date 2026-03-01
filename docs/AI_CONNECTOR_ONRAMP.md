# AI Connector Onramp

Use this when an AI agent needs to add or update connector-backed runtime behavior in WorkerFlow.

## Goal

Ship connector route changes that are executable, tested, and aligned with the docs-first connector model.

## Canonical Inputs

1. service metadata: `cloudflare/connector-registry/services.json`
2. runtime route/schedule contract: `docs/ENTRYPOINTS.md`
3. implementation rules: `docs/CONNECTOR_BUILD_SPEC.md`
4. prompt scaffold for delegation: `docs/AGENT_CONNECTOR_PLAYBOOK.md`
5. runtime secret registry: `cloudflare/shared/connector_registry.ts`
6. optional scaffold generator: `cd cloudflare && npm run connector:new -- --service "<name>" --route <route_id>`

## Exact Implementation Steps

1. pick target service row from `cloudflare/connector-registry/services.json`
2. confirm existing route ID or add new route contract in `cloudflare/shared/routes.ts` and `docs/ENTRYPOINTS.md`
3. implement/extend connector transport primitive in `cloudflare/workers/workflow/src/connectors/`
4. implement/extend route handler in `cloudflare/workers/workflow/src/handlers/http/`
5. add or update required secret mapping in `cloudflare/shared/connector_registry.ts`
6. add or update handler fixtures in `cloudflare/scripts/test_handler_fixtures.ts`
7. add or update connector HTTP contract tests in `cloudflare/scripts/test_connector_harness.ts`
8. update docs when behavior changes (`docs/SERVICE_API_INDEX.md`, `docs/CONNECTOR_CATALOG.md`, changelog if needed)

## Required Validation

```bash
cd cloudflare
npm run service-registry:refresh
npm run service-registry:build-index
npm run test:connector-registry
npm run test:service-registry
npm run release:check
```

CI also runs `npm run test:service-registry-urls` to verify each registry URL returns `2xx/3xx`.

## Done Criteria

1. route payload validation still passes
2. missing secret behavior is explicit in health/config checks
3. connector handles non-2xx provider responses with actionable errors
4. new/changed behavior is covered by fixtures/tests
5. release checks pass without regressions
