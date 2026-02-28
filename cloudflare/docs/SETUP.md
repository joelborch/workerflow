# Setup Checklist

## 1. Install and Auth

```bash
cd cloudflare
npm install
npm run preflight
npx wrangler login
cp .dev.vars.example .dev.vars
```

Set `GOOGLEAI_API_KEY` in `.dev.vars` for local workflow dev.
For delegated Google auth, also set `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_PRIVATE_KEY_PART1`, `GCP_PRIVATE_KEY_PART2`, and `GOOGLE_ADMIN_USER`.

## 2. Create Resources

```bash
npm run bootstrap
```

Fill placeholders in `infra/cloudflare.resources.json`, then run:

```bash
npm run bootstrap:apply
```

This runbook is machine-readable and suitable for LLM automation.

## 3. Apply D1 Migration

```bash
npx wrangler d1 migrations apply workerflow-runtime --local
npx wrangler d1 migrations apply workerflow-runtime --remote
```

## 4. Configure Secrets (Remote)

```bash
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put GCP_SERVICE_ACCOUNT_EMAIL --config workers/workflow/wrangler.jsonc
npx wrangler secret put GCP_PRIVATE_KEY_PART1 --config workers/workflow/wrangler.jsonc
npx wrangler secret put GCP_PRIVATE_KEY_PART2 --config workers/workflow/wrangler.jsonc
npx wrangler secret put GOOGLE_ADMIN_USER --config workers/workflow/wrangler.jsonc
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
```

## 5. Deploy Order

```bash
npm run preflight:strict
npm run deploy:ops
npm run deploy:workflow
npm run deploy:queue
npm run deploy:api
npm run deploy:scheduler
```

## 6. Smoke Checks

```bash
curl -i http://127.0.0.1:8787/api/health
```

Run this on each `dev:*` command in separate terminals.

For the ops dashboard:

- Start local server: `npm run dev:ops`
- Open UI: `http://127.0.0.1:8787/`

## 7. Environment References

- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [OPS_DASHBOARD_API.md](./OPS_DASHBOARD_API.md)
- [../../docs/CLOUDFLARE_SETUP_RUNBOOK.md](../../docs/CLOUDFLARE_SETUP_RUNBOOK.md)
