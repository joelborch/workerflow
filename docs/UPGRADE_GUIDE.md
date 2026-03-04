# Upgrade Guide

## 0.2.x -> 0.3.0

Highlights:

- runtime route catalog expanded from 12 to 21 HTTP routes (6 schedules unchanged)
- new connector-backed routes for Slack, GitHub, OpenAI, Stripe, Notion, and HubSpot
- new D1 migrations for workspace OAuth tokens and audit events
- docs-first connector/service registry added for safer OSS contributor workflows

Required actions:

1. review updated route contracts:
   - `cloudflare/contracts/routes.v1.json`
   - `cloudflare/contracts/schedules.v1.json`
2. apply D1 migrations before runtime rollout:
   - `cloudflare/migrations/d1/0003_workspace_oauth.sql`
   - `cloudflare/migrations/d1/0004_audit_events.sql`
3. set workflow secrets for any newly enabled connector routes:
   - `SLACK_WEBHOOK_URL` (`slack_message`)
   - `GITHUB_TOKEN` (`github_issue_create`)
   - `OPENAI_API_KEY` (`openai_chat`)
   - `STRIPE_API_KEY` (`stripe_payment_intent_create`, `stripe_customer_upsert`)
   - `NOTION_TOKEN` (`notion_database_item_create`, `notion_database_item_get`)
   - `HUBSPOT_ACCESS_TOKEN` (`hubspot_contact_upsert`, `hubspot_deal_upsert`)
4. regenerate any downstream API clients that depend on `cloudflare/openapi.json`
5. rerun full validation:

```bash
cd cloudflare
npm run release:check

cd ../pages-dashboard
npm run release:check
```

## 0.1.x -> 0.2.0

Highlights:

- starter catalog expanded to 12 routes and 6 schedules
- ingress hardening added (HMAC signature + rate limit options)
- ops dashboard RBAC supports read/write token split
- core manifest/enablement logic extracted into `packages/core-runtime`

Required actions:

1. review updated route/schedule contracts:
   - `cloudflare/contracts/routes.v1.json`
   - `cloudflare/contracts/schedules.v1.json`
2. update scheduler cron triggers in `workers/scheduler/wrangler.jsonc`
3. if enabling HMAC, configure `API_HMAC_SECRET` for API worker
4. if using dashboard RBAC, set `OPS_DASHBOARD_READ_TOKEN` and `OPS_DASHBOARD_WRITE_TOKEN`
5. rerun full validation:

```bash
cd cloudflare
npm run release:check
```
