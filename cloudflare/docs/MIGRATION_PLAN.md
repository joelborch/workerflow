# Migration Plan

This plan tracks WorkerFlow evolution from starter catalog to production-scale platform.

## Phase 1: Reliable Core (Current)

- ingress/queue/workflow/scheduler/ops workers implemented
- D1 state schema and dead-letter support in place
- manifest contracts + fixture tests in CI
- security controls for ingress + dashboard role split

## Phase 2: Catalog + Connector Growth

- expand generic recipe catalog beyond starter set
- publish connector profiles with explicit secret requirements
- add curated deployment templates for common use-cases

## Phase 3: Packaging And Ecosystem

- complete runtime extraction into `packages/core-runtime`
- keep cloudflare runtime as thin deployment adapter
- harden handler-sdk ergonomics for community recipes

## Release Gates

- `npm run release:check`
- changelog + upgrade guide updates
- semver tag cut
