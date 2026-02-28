# Production Readiness Checklist

Use this checklist before running WorkerFlow in production.

## 1. Cloudflare Resource Baseline

- [ ] D1 database created and migrations applied (`--remote`)
- [ ] queue created and bound to API + queue-consumer
- [ ] all worker service bindings resolve correctly
- [ ] wrangler files contain real IDs in private deployment repo only

## 2. Security Baseline

- [ ] `API_INGRESS_TOKEN` enabled
- [ ] `API_HMAC_SECRET` enabled for signed clients
- [ ] dashboard RBAC enabled (`OPS_DASHBOARD_READ_TOKEN` / `OPS_DASHBOARD_WRITE_TOKEN`)
- [ ] secret values stored via `wrangler secret put` or Secrets Store
- [ ] no secrets in `vars`, source code, or docs

## 3. Reliability Baseline

- [ ] dead-letter handling monitored (`/api/ops/dead-letters`)
- [ ] retry/replay process documented for operators
- [ ] idempotency behavior tested for critical routes
- [ ] cron schedules reviewed for safe execution windows

## 4. Observability And Alerting

- [ ] dashboard deployed and token-protected
- [ ] alert route configured (`chat_notify` / `slack_message` or equivalent)
- [ ] error clusters reviewed daily
- [ ] minimum SLO/SLA targets defined for critical workflows

## 5. Capacity And Cost Controls

- [ ] expected request + queue volume estimated
- [ ] CPU/runtime profile tested with representative payloads
- [ ] Cloudflare plan quotas reviewed against expected load
- [ ] backpressure plan defined for burst traffic

## 6. Release And Rollback Discipline

- [ ] `npm run release:check` passing in CI
- [ ] branch protection enabled on `main`
- [ ] release tags created for deployable versions (`vX.Y.Z`)
- [ ] rollback procedure tested to previous known-good tag

## 7. Data Safety

- [ ] D1 backup/export process documented
- [ ] retention policy defined for run/dead-letter data
- [ ] PII handling and redaction rules documented

## 8. Connector Hardening (If Used)

- [ ] connector credentials scoped minimally
- [ ] connector API error handling and retries validated
- [ ] contract tests cover connector request/response mapping
- [ ] rate-limit behavior tested for vendor APIs
