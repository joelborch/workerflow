# Migration Plan (Scaffold Stage)

## Current Status

- Scaffolded workers are in place.
- Legacy routes and active schedules are captured in manifests.
- Queue + D1 + service-binding baseline is wired.
- Execution handlers are stubs and need per-flow implementation.

## Next Implementation Steps

1. Implement `workers/workflow/src/index.ts` dispatch table:
   - Map route/schedule keys to real handlers.
   - Port one flow at a time from `f/**`.
2. Add integrations layer:
   - Chat/webhook connectors
   - CRM/task connectors
   - Email connectors
   - Crawl/scrape connectors
3. Replace legacy state calls:
   - `getVariable/setVariable` -> `cursor_state` table helpers
   - `runFlowAsync` -> queue delayed task pattern
4. Implement auth policy per route:
   - Keep public routes where required.
   - Add HMAC/shared secret where possible.
5. Add retry policy and dead-letter replay CLI scripts.
6. Cut over route-by-route with canary mode.

## Known Blockers

- Flows that depend on Node-only APIs (for example `node:child_process`) must be replaced with API-based execution or external workers.
