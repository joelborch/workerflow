# Upgrade Guide

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
