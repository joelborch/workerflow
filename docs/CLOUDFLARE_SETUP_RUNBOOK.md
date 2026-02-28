# Cloudflare Setup Runbook

Use this runbook to provision WorkerFlow on a Cloudflare account.

## 1. Install + Initialize

```bash
cd cloudflare
npm install
npm run init
npm run preflight
```

## 2. Define Resource IDs

Edit `infra/cloudflare.resources.json` and replace all `REPLACE_WITH_*` values.

## 3. Generate + Apply Plan

```bash
cd cloudflare
npm run bootstrap
npm run bootstrap:apply
```

## 4. Configure Secrets

```bash
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put API_HMAC_SECRET --config workers/api/wrangler.jsonc
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put CHAT_WEBHOOK_URL --config workers/workflow/wrangler.jsonc
npx wrangler secret put CLEANUP_SIGNING_SECRET --config workers/workflow/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_READ_TOKEN --config workers/ops-dashboard/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_WRITE_TOKEN --config workers/ops-dashboard/wrangler.jsonc
```

## 5. Validate + Deploy

```bash
cd cloudflare
npm run release:check
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
npm run deploy:ops
```

## 6. Post-Deploy Verification

- `GET /api/health`
- `POST /api/webhook_echo`
- `POST /api/dev/cron/heartbeat_hourly`
- dashboard `GET /api/summary` with read token

## 7. Security Baseline

- keep `API_INGRESS_TOKEN` enabled
- keep `API_HMAC_SECRET` enabled for signed clients
- use dashboard read/write token split in production
