# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

No entries yet.

## [0.3.0] - 2026-03-04

### Added

- nine connector-backed HTTP routes:
  - `slack_message`
  - `github_issue_create`
  - `openai_chat`
  - `stripe_payment_intent_create`
  - `stripe_customer_upsert`
  - `notion_database_item_create`
  - `notion_database_item_get`
  - `hubspot_contact_upsert`
  - `hubspot_deal_upsert`
- connector clients and fixture coverage for Slack, GitHub, OpenAI, Stripe, Notion, and HubSpot
- docs-first connector planning assets:
  - `docs/SERVICE_API_INDEX.md`
  - `docs/CONNECTOR_BUILD_SPEC.md`
  - `docs/AGENT_CONNECTOR_PLAYBOOK.md`
  - `cloudflare/connector-registry/services.json` (100 services)
  - `cloudflare/shared/connector_registry.ts`
- D1 migrations:
  - `cloudflare/migrations/d1/0003_workspace_oauth.sql`
  - `cloudflare/migrations/d1/0004_audit_events.sql`
- release and security automation:
  - canary deploy workflow
  - release-tag draft workflow
  - CodeQL workflow
  - secret scanning workflow
- issue templates, PR template, CODEOWNERS, and refined Dependabot settings
- production-readiness checklist and API/contract versioning policy docs
- starter examples for Slack alerts, GitHub issue creation, and AI summary-to-Slack
- milestone-backed public contributor queue (`Next 10 OSS Issues`)
- expanded docs coverage for agent setup and connector catalog usage

### Changed

- route catalog increased from 12 to 21 HTTP routes (6 schedules unchanged)
- runtime release checks now include connector registry and service registry quality gates
- ops dashboard connector secret status now derives from shared runtime connector registry
- rewritten `README.md` to emphasize Cloudflare-native, free-tier-friendly self-hosting
- standardized wording/style across runtime and platform markdown docs
- improved contributing guidance and quality-gate instructions

### Fixed

- service registry schema is now vendor-neutral
- service registry no longer references third-party directory paths
- runtime code-scanning findings addressed
- Dependabot/CI churn reduced via workflow and config hardening

## [0.2.1] - 2026-02-28

### Added

- security contact guidance (`SECURITY.md`)

### Changed

- required release checks for both Cloudflare runtime and Pages dashboard in CI

## [0.2.0] - 2026-02-28

### Added

- expanded starter catalog (12 HTTP routes, 6 cron schedules)
- additional generic handlers (transform, extract, template, fanout, incident, rollup)
- ingress security test suite (`test:ingress-security`)
- failure mode test suite (`test:failure-modes`)
- benchmark script (`bench:manifest`)
- init project script (`npm run init`)
- architecture, roadmap, security model, upgrade, and release docs
- initial extracted `packages/core-runtime` modules (manifest + enablement)

### Changed

- improved runtime metadata and status docs for clearer v1 scope
- simplified workflow wrangler secrets to generic starter set
- scheduler trigger set aligned to expanded default schedules
- ops dashboard auth supports read/write role split
- cloudflare runtime package version bumped to `0.2.0`

## [0.1.0] - 2026-02-28

### Added

- initial public WorkerFlow runtime baseline
