# Environment And Secrets

Use `wrangler secret put` for sensitive values.

## Required Secrets (Default Manifest)

- `GOOGLEAI_API_KEY` (required by `lead_normalizer`)
- `CHAT_WEBHOOK_URL` (required by `chat_notify`)
- `CLEANUP_SIGNING_SECRET` (required by `cleanup_daily`)

Compatibility aliases for chat webhook:

- `GCHAT_ALERTS_WEBHOOK_URL`
- `GCHAT_ALERTS_WEBHOOK`

## Recommended Security

- `API_INGRESS_TOKEN` on `workers/api`
- `OPS_DASHBOARD_TOKEN` on `workers/ops-dashboard`

## Manifest Mode Configuration

Default mode: `legacy` (checked-in manifests)

Config mode:

- `MANIFEST_MODE=config`
- `ROUTES_CONFIG_JSON`
- `SCHEDULES_CONFIG_JSON`

Example route gating:

- `ENABLED_HTTP_ROUTES=chat_notify,lead_normalizer`
- `DISABLED_HTTP_ROUTES=webhook_echo`

## Legacy Endpoint Alert Hook (Optional)

- `LEGACY_ALERT_WEBHOOK_URL`

Fallbacks:

- `GCHAT_ALERTS_WEBHOOK`
- `GCHAT_ALERTS_WEBHOOK_URL`

## Quick Commands

```bash
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put CHAT_WEBHOOK_URL --config workers/workflow/wrangler.jsonc
npx wrangler secret put CLEANUP_SIGNING_SECRET --config workers/workflow/wrangler.jsonc
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
```
