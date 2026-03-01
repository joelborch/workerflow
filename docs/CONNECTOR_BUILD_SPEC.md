# Connector Build Spec

This is the implementation contract for adding or extending connector-backed routes in WorkerFlow.

## Scope

A connector implementation includes:

- one or more runtime route handlers in `cloudflare/workers/workflow/src/handlers/http/`
- a connector primitive in `cloudflare/workers/workflow/src/connectors/`
- required secret validation in `cloudflare/shared/connector_registry.ts`
- tests in `cloudflare/scripts/`

Optional scaffold bootstrap:

```bash
cd cloudflare
npm run connector:new -- --service "<service>" --route <route_id> --dry-run
```

## Required Design Rules

1. Keep transport logic in connector primitives, not route handlers.
2. Use `fetchWithRetry` for outbound API calls where possible.
3. Normalize and validate input in handlers.
4. Return object outputs only from handlers.
5. Throw structured errors where possible (`WorkflowHandlerError` for rich error payloads).
6. Avoid embedding secrets in payloads or logs.

## Runtime Contract

1. Route IDs are stable contract keys.
2. Route payload validation must pass `validateRoutePayload` rules.
3. Secret requirements must be declared in `connector_registry.ts` per route.
4. `GET /health/config` must report missing secret checks for enabled routes.

## Handler Pattern

Use this shape:

1. resolve `env`
2. unwrap payload body
3. resolve required secret(s)
4. validate required payload fields
5. call connector primitive
6. return normalized output object

## Connector Primitive Pattern

1. Accept typed args object.
2. Construct provider URL deterministically.
3. Add auth headers from args.
4. Retry transient failures (`408/425/429/5xx`).
5. On non-OK response, throw clear error with status/body details.
6. Normalize provider response into stable return shape.

## Idempotency Guidance

For mutating APIs:

1. Use provider idempotency keys when supported.
2. Default to a trace-derived key in handlers (e.g. `workerflow-${traceId}-...`).
3. Keep key derivation deterministic per route intent.

## Test Requirements

At minimum add or update:

1. `test_handler_fixtures.ts` for handler success/failure behavior.
2. `test_connector_harness.ts` for connector HTTP contract behavior.
3. `test_runtime_config.ts` for secret requirement enforcement if new secret keys are introduced.
4. Any route fixture/runtime config tests touched by contract changes.

## Required Validation

```bash
cd cloudflare
npm run release:check
```

For dashboard/UI changes related to connector visibility:

```bash
cd pages-dashboard
npm run release:check
```
