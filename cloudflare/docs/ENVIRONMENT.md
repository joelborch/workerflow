# Environment And Secrets

Use `wrangler secret put` for secrets. Use non-secret vars only when appropriate.

## Core Secrets

- `GOOGLEAI_API_KEY` (required by `lead_normalizer` default recipe)
- `CHAT_WEBHOOK_URL` (required by `chat_notify` default recipe)
- `CLEANUP_SIGNING_SECRET` (required by `cleanup_daily` default recipe)

Compatibility aliases supported:

- `GCHAT_ALERTS_WEBHOOK_URL`
- `GCHAT_ALERTS_WEBHOOK`

## Optional Ops Dashboard Access Token

- `OPS_DASHBOARD_TOKEN` (used by `workers/ops-dashboard` API endpoints)

## Optional API Route Gating

Use these on `workers/api` to explicitly expose only enabled HTTP routes:

- `ENABLED_HTTP_ROUTES`: comma-separated allowlist. If set, only listed routes are accepted.
- `DISABLED_HTTP_ROUTES`: comma-separated blocklist applied after allowlist.

## Optional Manifest Mode (Advanced)

Default mode is `legacy`, which uses checked-in route/schedule manifests from `shared/routes.ts` and `shared/schedules.ts`.

Set this to load manifests from environment JSON instead:

- `MANIFEST_MODE=config`
- `ROUTES_CONFIG_JSON`: JSON array matching `RouteDefinition[]`
- `SCHEDULES_CONFIG_JSON`: JSON array matching `ScheduleDefinition[]`

If `MANIFEST_MODE=config` and either JSON value is missing, runtime falls back to the legacy manifest for that section.
If JSON is invalid, runtime returns an error.

Examples:

- `config/routes.config.example.json`
- `config/schedules.config.example.json`

Example:

- `ENABLED_HTTP_ROUTES=chat_notify,lead_normalizer`
- `DISABLED_HTTP_ROUTES=webhook_echo`

## Optional API Ingress Auth

Set on `workers/api`:

- `API_INGRESS_TOKEN`: if set, every `POST /api/{route}` request must include one of:
  - `Authorization: Bearer <token>`
  - `x-api-token: <token>`
  - `x-api-key: <token>`
  - `x-webhook-token: <token>`

## Optional Legacy Endpoint Hit Alerts

Set on `workers/api` if you want immediate Google Chat alerts whenever deprecated legacy ingress paths are hit:

- `LEGACY_ALERT_WEBHOOK_URL`

Fallbacks supported by runtime (same target chat can be reused):

- `GCHAT_ALERTS_WEBHOOK`
- `GCHAT_ALERTS_WEBHOOK_URL`

## Quick Secret Commands

Example (`workers/workflow`):

```bash
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put CHAT_WEBHOOK_URL --config workers/workflow/wrangler.jsonc
npx wrangler secret put CLEANUP_SIGNING_SECRET --config workers/workflow/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
npx wrangler secret put LEGACY_ALERT_WEBHOOK_URL --config workers/api/wrangler.jsonc
```
