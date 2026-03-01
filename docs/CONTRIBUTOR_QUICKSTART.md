# Contributor Quickstart

Start here if you want to make your first OSS contribution to WorkerFlow.

## 1) Pick A First Task

Recommended issue filters:

- good first issues:
  - <https://github.com/joelborch/workerflow/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22>
- help wanted:
  - <https://github.com/joelborch/workerflow/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22>
- documentation:
  - <https://github.com/joelborch/workerflow/issues?q=is%3Aopen+is%3Aissue+label%3Adocumentation>

Starter contribution areas:

- improve docs clarity in runbooks (`docs/`)
- expand connector service docs index and registry (`docs/SERVICE_API_INDEX.md`, `cloudflare/connector-registry/`, `docs/AI_CONNECTOR_ONRAMP.md`)
- extend tests for runtime guardrails (`cloudflare/scripts/test_*.ts`)
- improve dashboard filters and UX (`pages-dashboard/src/`)

## 2) Local Setup

```bash
git clone https://github.com/joelborch/workerflow.git
cd workerflow
```

Install and validate runtime:

```bash
cd cloudflare
npm install
npm run migrations:guard:strict
npm run release:check
```

For dashboard changes:

```bash
cd ../pages-dashboard
npm install
npm run release:check
```

## 3) Branch + PR

```bash
git checkout -b feat/<short-description>
```

Before opening PR:

- run required checks (runtime + dashboard when applicable)
- update docs when adding new env vars, routes, or ops behaviors
- link issue in PR description using `Closes #<number>`

## 4) Labeling Conventions

Core labels used for onboarding:

- `good first issue`
- `help wanted`
- `documentation`
- `connector`
- `runtime`
- `ci-cd`

If a useful issue is unlabelled, mention it in the PR or issue comments so maintainers can tag it for new contributors.
