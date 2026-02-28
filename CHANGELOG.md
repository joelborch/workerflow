# Changelog

All notable changes to this project are documented in this file.

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
