# Security Model

## Ingress Protection

`workers/api` supports layered controls:

- bearer/token ingress auth (`API_INGRESS_TOKEN`)
- request signing with HMAC SHA-256 (`API_HMAC_SECRET`)
- signature timestamp skew control (`API_HMAC_MAX_SKEW_SECONDS`)
- best-effort per-client rate limiting (`API_RATE_LIMIT_PER_MINUTE`)

Recommended production posture:

1. enable both `API_INGRESS_TOKEN` and `API_HMAC_SECRET`
2. keep signature skew low (default 300s)
3. combine worker-level rate limits with Cloudflare WAF/rate-limit rules

## Ops Dashboard RBAC

`workers/ops-dashboard` supports token-based role separation:

- `OPS_DASHBOARD_READ_TOKEN`: read-only access (GET endpoints)
- `OPS_DASHBOARD_WRITE_TOKEN`: write access (retry/cron-run POST endpoints)
- `OPS_DASHBOARD_TOKEN`: backward-compatible single admin token

## Secret Management

- store secrets in Cloudflare Secrets Store
- avoid plain `vars` for sensitive values
- keep public repos placeholder-only for resource IDs

## Multi-Tenant Guidance

WorkerFlow is single-tenant by default; for multi-tenant deployments:

- isolate tenants by route namespace and queue/task metadata
- include tenant identity in every task payload and D1 writes
- use tenant-scoped secrets and token policies
- avoid cross-tenant replay/retry without explicit guardrails

## Legacy Endpoint Cutover Safety

Keep legacy endpoint alerting enabled during migration windows:

- `LEGACY_ALERT_WEBHOOK_URL`
