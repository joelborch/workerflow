# Setup Checklist

## 1. Install + Authenticate

```bash
cd cloudflare
npm install
npm run preflight
npx wrangler login
cp .dev.vars.example .dev.vars
```

## 2. Provision Resources

Generate and apply plan:

```bash
npm run bootstrap
npm run bootstrap:apply
```

If applying manually, ensure D1 + queue + worker bindings match `wrangler.jsonc` files.

## 3. Apply Migrations

```bash
npx wrangler d1 migrations apply workerflow-runtime --local
npx wrangler d1 migrations apply workerflow-runtime --remote
```

## 4. Configure Secrets

```bash
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put CHAT_WEBHOOK_URL --config workers/workflow/wrangler.jsonc
npx wrangler secret put CLEANUP_SIGNING_SECRET --config workers/workflow/wrangler.jsonc
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
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

## 6. Smoke Validation

- `GET /api/health`
- invoke one route: `POST /api/webhook_echo`
- enqueue one schedule: `POST /api/dev/cron/heartbeat_hourly`
- inspect run/dead-letter endpoints on ops dashboard

## 7. References

- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [OPS_DASHBOARD_API.md](./OPS_DASHBOARD_API.md)
- [../../docs/CLOUDFLARE_SETUP_RUNBOOK.md](../../docs/CLOUDFLARE_SETUP_RUNBOOK.md)
