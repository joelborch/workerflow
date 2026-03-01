# Governance

This document defines how WorkerFlow accepts changes and maintains quality as a public OSS project.

## Project Scope

WorkerFlow public repository scope:

- Cloudflare-native workflow runtime primitives
- route/schedule contracts and operational guardrails
- docs-first connector development model
- generic examples, templates, and runbooks

Out of scope for public repo:

- customer-specific integrations
- private credentials, internal endpoints, business logic overlays

## Maintainer Responsibilities

Maintainers are expected to:

1. enforce security/public-export guardrails
2. require tests/docs for behavior changes
3. keep release and migration safety checks green
4. triage issues and PRs with clear status labels

## Change Acceptance Criteria

A PR is merge-ready when all are true:

1. scope and risk are clear in PR summary
2. required checks pass (`cloudflare` and `pages-dashboard` where applicable)
3. docs are updated for operator-facing changes
4. no secrets/private identifiers are introduced
5. breaking changes include upgrade guidance

## Ownership Model

Code ownership is declared in `.github/CODEOWNERS` by area.

- reviewers should request owner approval for high-risk areas (`cloudflare/`, `.github/workflows/`, security docs)
- connector additions must include implementation/test/doc updates together

## Decision Process

- small fixes: maintainer merge after required checks
- larger changes: discussion in issue/PR before implementation
- security-sensitive changes: follow `SECURITY.md` private reporting workflow

## Release Discipline

- release-related contract changes must be validated with runbooks under `docs/`
- dependency/security automation should stay enabled and green
- when in doubt, prefer smaller, reviewable PRs over large unscoped changes
