# Setup Checklist

Use this checklist to stand up WorkerFlow on Cloudflare with clean, repeatable steps.

## 1. Install and Initialize

```bash
cd cloudflare
npm install
npm run init
npm run preflight
npx wrangler login
```

## 2. Provision Resources

```bash
npm run bootstrap
npm run bootstrap:apply
```

Ensure placeholders are replaced in worker configs and infra spec.

## 3. Apply Migrations

```bash
npx wrangler d1 migrations apply workerflow-runtime --local
npx wrangler d1 migrations apply workerflow-runtime --remote
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

## 5. Deploy

```bash
npm run preflight:strict
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
npm run deploy:ops
```

## 6. Validate

```bash
npm run release:check
```

Endpoint smoke checks:

- `GET /api/health`
- `POST /api/webhook_echo`
- `POST /api/dev/cron/heartbeat_hourly`
- ops dashboard `GET /api/summary` with auth token

## 7. References

- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [OPS_DASHBOARD_API.md](./OPS_DASHBOARD_API.md)
- [../../docs/CLOUDFLARE_SETUP_RUNBOOK.md](../../docs/CLOUDFLARE_SETUP_RUNBOOK.md)
