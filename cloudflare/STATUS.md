# Cloudflare Runtime Status

Last updated: 2026-02-28

## Positioning

WorkerFlow v1 is a practical automation runtime for teams that want cloud automation control without recurring per-seat SaaS pricing or VPS maintenance.

## V1 Scope (Implemented)

- API ingress with sync/async route handling
- queue-based background execution
- cron schedule enqueueing
- D1-backed idempotency/run/dead-letter state
- ops dashboard APIs for inspection and retry flows
- manifest mode (`legacy` and `config`) with contracts

## V1 Starter Catalog

Default manifest currently ships with:

- 12 HTTP routes
- 6 cron schedules

These are generic starter recipes for common patterns (transform, notify, fanout, incident, digest, cleanup, rollups).

## Reliability and Security

Implemented:

- idempotency key tracking
- dead-letter capture and replay checks
- route allow/deny gating
- optional ingress token auth (`API_INGRESS_TOKEN`)
- optional ingress HMAC signing (`API_HMAC_SECRET`)
- optional per-client rate limiting (`API_RATE_LIMIT_PER_MINUTE`)
- ops dashboard read/write token support

## Resource Template Requirements

Wrangler configs intentionally contain placeholders:

- `REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID`
- `REPLACE_WITH_D1_DATABASE_ID`
- `REPLACE_WITH_SECRETS_STORE_ID`

## Near-Term Roadmap

1. continue extracting runtime primitives into `packages/core-runtime`
2. expand recipe catalog and connector presets
3. improve ops UX and replay tooling
4. publish stronger multi-tenant reference patterns
5. harden release automation and semver process
