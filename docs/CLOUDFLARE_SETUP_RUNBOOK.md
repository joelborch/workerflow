# Cloudflare Setup Runbook

## 1. Install and Validate

```bash
cd cloudflare
npm install
npm run preflight
```

## 2. Fill Infra Spec

Edit:

- `infra/cloudflare.resources.json`

Replace all `REPLACE_WITH_*` values with real resource identifiers.

## 3. Generate Bootstrap Plan

```bash
cd cloudflare
npm run bootstrap
```

This prints machine-readable JSON command steps for D1, Queue, migrations, and deploy.

## 4. Apply Bootstrap Commands

```bash
cd cloudflare
npm run bootstrap:apply
```

## 5. Set Secrets

Examples:

```bash
npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc
npx wrangler secret put API_INGRESS_TOKEN --config workers/api/wrangler.jsonc
npx wrangler secret put OPS_DASHBOARD_TOKEN --config workers/ops-dashboard/wrangler.jsonc
```

## 6. Verify Runtime

```bash
cd cloudflare
npm run test:compat-contract
npm run test:manifest-mode
npm run test:schedule-fixtures
npm run test:runtime-config
npm run test:route-fixtures
npm run test:handler-fixtures
```

## 7. Private Deploy Guard (Private Repo)

Before deploying private production environments:

```bash
cd cloudflare
npm run deploy:guard:strict
```

This ensures no `REPLACE_WITH_*` placeholders remain in deploy config.
