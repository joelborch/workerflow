# Agent Connector Playbook

Use this playbook when asking an AI agent to implement a connector route in WorkerFlow.

Before using this template, follow `docs/AI_CONNECTOR_ONRAMP.md` for the exact file-by-file implementation flow.

## Inputs You Provide

1. target service name
2. base docs link (from `docs/SERVICE_API_INDEX.md`)
3. desired route ID(s)
4. trigger/action behavior in plain language
5. required payload fields

## Prompt Template

```text
Implement a WorkerFlow connector route.

Service: <service>
Route ID(s): <route ids>
Base docs: <official docs url>
Behavior: <what should happen>
Payload contract: <required/optional fields>

Constraints:
- follow docs/CONNECTOR_BUILD_SPEC.md
- keep transport logic in connectors/ and route logic in handlers/http/
- use fetchWithRetry for outbound calls
- declare required secrets in cloudflare/shared/connector_registry.ts
- add tests in cloudflare/scripts/test_handler_fixtures.ts and test_connector_harness.ts
- do not break existing routes/contracts
- run cloudflare release checks

Deliverables:
- code changes
- tests
- short summary of added secrets, routes, and failure behavior
```

## Agent Acceptance Checklist

1. route handler compiles and returns object output
2. secret validation fails clearly when missing
3. connector primitive handles non-2xx with actionable error
4. tests cover success and at least one failure mode
5. `npm run release:check` passes in `cloudflare/`

## Common Failure Modes

1. placing auth/HTTP logic in handler instead of connector primitive
2. skipping secret registration in `connector_registry.ts`
3. non-deterministic idempotency key behavior for mutating APIs
4. parsing provider response without type guards
5. missing fixture coverage for failure branches
