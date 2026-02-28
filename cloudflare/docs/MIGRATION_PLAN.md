# Migration Plan

This plan tracks evolution from the default scaffold to a production-grade automation platform.

## Phase 1: Foundation

Status: active

- keep ingress/queue/workflow/scheduler/ops workers stable
- preserve compatibility contracts for route/schedule IDs
- maintain full fixture and contract test coverage

## Phase 2: Modularization

Status: active

- extract reusable runtime pieces into `packages/core-runtime`
- stabilize handler APIs in `packages/handler-sdk`
- expand example/public recipe packages

## Phase 3: Ecosystem

Status: planned

- grow connector set and recipe catalog
- publish clearer deployment presets and templates
- improve operator UX for replay/retry workflows

## Release Gates

- `npm run preflight`
- `npm run test:compat-contract`
- `npm run test:manifest-mode`
- `npm run test:schedule-fixtures`
- `npm run test:runtime-config`
- `npm run test:route-fixtures`
- `npm run test:handler-fixtures`
- `npm run typecheck`

## Known Constraints

- Some legacy flows may rely on Node-only APIs and need externalization for Worker runtime compatibility.
- Connector-specific secret sprawl should be reduced into clearer secret profiles over time.
