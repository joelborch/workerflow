# Cloudflare Setup Runbook

This runbook is for first-time provisioning of WorkerFlow on a Cloudflare account.

## 1. Install Dependencies

```bash
cd cloudflare
npm install
npm run preflight
```

## 2. Define Resource IDs

Edit:

- `infra/cloudflare.resources.json`

Replace every `REPLACE_WITH_*` placeholder with real IDs.

## 3. Generate Provisioning Plan

```bash
cd cloudflare
npm run bootstrap
```

Review the generated commands for D1, queue, migrations, and deploy order.

## 4. Apply Plan

```bash
cd cloudflare
npm run bootstrap:apply
```

## 5. Configure Secrets

Minimum recommended set:

```bash
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put CHAT_WEBHOOK_URL --config workers/workflow/wrangler.jsonc
npx wrangler secret put CLEANUP_SIGNING_SECRET --config workers/workflow/wrangler.jsonc
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
```

## 6. Validate Runtime

```bash
cd cloudflare
npm run test:compat-contract
npm run test:manifest-mode
npm run test:schedule-fixtures
npm run test:runtime-config
npm run test:route-fixtures
npm run test:handler-fixtures
npm run typecheck
```

## 7. Verify Live Endpoints

- API health: `GET /api/health`
- Workflow health: `GET /health`
- Ops health: `GET /health` (ops worker)
- Trigger one route and one schedule path to confirm end-to-end behavior.

## 8. Hardening Checklist

- Keep ingress auth enabled (`API_INGRESS_TOKEN`).
- Keep dashboard auth enabled (`OPS_DASHBOARD_TOKEN`).
- Run strict deploy guard before production deploy in private overlays.
