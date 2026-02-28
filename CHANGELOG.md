# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- three production-ready connector routes:
  - `slack_message`
  - `github_issue_create`
  - `openai_chat`
- connector clients and fixture coverage for Slack, GitHub, and OpenAI
- issue templates, PR template, CODEOWNERS, and Dependabot config
- production-readiness checklist and API/contract versioning policy docs
- starter examples for Slack alerts, GitHub issue creation, and AI summary-to-Slack
- milestone-backed public contributor queue (`Next 10 OSS Issues`)
- stronger top-level positioning and cost-profile documentation
- brand language standard for docs (`docs/BRAND_STANDARD.md`)
- expanded docs coverage for agent setup and connector catalog usage

### Changed

- starter route catalog increased to 15 HTTP routes
- rewritten `README.md` to emphasize Cloudflare-native, free-tier-friendly self-hosting
- standardized wording/style across runtime and platform markdown docs
- improved contributing guidance and quality-gate instructions

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
