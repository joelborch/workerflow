# Environment and Secrets

WorkerFlow keeps secret wiring explicit so teams and coding agents can bootstrap safely and predictably.

Use `wrangler secret put` for all sensitive values.

## Required Secrets (Default Manifest)

- `API_INGRESS_TOKEN` (workers/api)
- `GOOGLEAI_API_KEY` (lead normalization route)
- `CHAT_WEBHOOK_URL` (notify/incident routes)
- `CLEANUP_SIGNING_SECRET` (cleanup schedule)

## Optional Ingress Security

- `API_HMAC_SECRET`
- `API_HMAC_MAX_SKEW_SECONDS` (seconds, defaults to 300)
- `API_RATE_LIMIT_PER_MINUTE`

## Optional Dashboard RBAC

- `OPS_DASHBOARD_READ_TOKEN`
- `OPS_DASHBOARD_WRITE_TOKEN`
- compatibility fallback: `OPS_DASHBOARD_TOKEN`

## Optional Runtime Secrets

- `FANOUT_SHARED_WEBHOOK_URL` (used when `webhook_fanout` has no explicit webhook list)
- `LEAD_NORMALIZER_API_KEY` (fallback alias)
- `LEGACY_ALERT_WEBHOOK_URL` (legacy endpoint alerting)
- `SLACK_WEBHOOK_URL` (for `slack_message`)
- `GITHUB_TOKEN` (for `github_issue_create`)
- `GITHUB_REPO` (default repository for `github_issue_create`)
- `OPENAI_API_KEY` (for `openai_chat`)
- `OPENAI_MODEL` (optional default model override for `openai_chat`)

Compatibility aliases:

- `GCHAT_ALERTS_WEBHOOK_URL`
- `GCHAT_ALERTS_WEBHOOK`

## Manifest Mode

Default mode: `legacy`.

Config mode:

- `MANIFEST_MODE=config`
- `ROUTES_CONFIG_JSON`
- `SCHEDULES_CONFIG_JSON`

Route gating example:

- `ENABLED_HTTP_ROUTES=chat_notify,incident_create`
- `DISABLED_HTTP_ROUTES=noop_ack`

## Quick Secret Commands

```bash
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put API_HMAC_SECRET --config workers/api/wrangler.jsonc
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put CHAT_WEBHOOK_URL --config workers/workflow/wrangler.jsonc
npx wrangler secret put CLEANUP_SIGNING_SECRET --config workers/workflow/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_READ_TOKEN --config workers/ops-dashboard/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_WRITE_TOKEN --config workers/ops-dashboard/wrangler.jsonc
```
