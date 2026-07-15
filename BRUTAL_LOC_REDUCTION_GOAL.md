# Brutal LOC Reduction Goal

## Gate decision

**GO, with a bounded target and hard abort conditions.** The audit supports an estimated **660-930 net physical lines** of honest reduction from handwritten product and operational-tooling code. That is approximately **4.6-6.4% of the 14,486-line reducible baseline** and **1.8-2.6% of the entire 35,923-line tracked repository**. The opportunity is real but it does not justify deleting either dashboard, changing prompts, replacing source with generated output, or compressing readable code.

This file is a plan only. No implementation, dependency change, generated artifact refresh, commit, push, deployment, migration, remote smoke test, or Cloudflare mutation is authorized.

## Objective

Reduce the largest defensible amount of handwritten WorkerFlow production and operational-tooling code while preserving every observable route, schedule, payload, status code, error contract, persistence behavior, security boundary, telemetry field, extension point, browser behavior, visual output, artifact output, and prompt byte.

Success means a smaller implementation because duplicated behavior has one canonical owner and a very small amount of affirmatively proven unreachable code is gone. Success does not mean fewer tests, fewer types, weaker checks, smaller documentation, generated-code substitution, denser formatting, or moving code outside the measured tree.

## Non-goals

- Do not remove, replace, merge, or feature-reduce the Worker-served inline ops dashboard or the standalone React Pages dashboard.
- Do not delete, shorten, paraphrase, deduplicate, relocate, encode, generate, reorder, or otherwise alter prompts or prompt interpolation semantics.
- Do not change stable route IDs, schedule IDs, paths, methods, request/response shapes, status codes, CORS behavior, replay behavior, workspace isolation, or manifest compatibility.
- Do not remove tests, fixtures, snapshots, documentation, schemas, contracts, migrations, lockfiles, generated catalogs, generated SDK output, examples, logs, audit events, or security checks.
- Do not weaken types, error handling, retries, idempotency, observability, deploy guards, migration guards, secret redaction, ingress authentication, HMAC validation, dashboard RBAC, or internal service authentication.
- Do not introduce a dependency merely to outsource code or reduce measured LOC.
- Do not deploy, apply migrations, change bindings/routes/secrets, or run a production-mutating smoke test.

## Baseline identity and repository state

| Field | Baseline |
| --- | --- |
| Repository | `/Volumes/Development/Joel/workerflow` |
| Baseline branch | `main` |
| Baseline commit | `d71d49dfc80022ee0cac405ef3d680a1514b7864` |
| Baseline upstream | `origin/main`, ahead 0 / behind 0 in the existing local refs |
| Planning branch | `codex/brutal-loc-reduction-plan-2026-07-15` |
| Remotes | `origin https://github.com/joelborch/workerflow.git` for fetch and push |
| Tracked/staged changes before branch creation | None |
| Pre-existing untracked user work | `CLAUDE.md` |
| Planning edit | This file only; `CLAUDE.md` remains untouched and untracked |
| Tracked files | 240 |
| Tracked physical lines | 35,923 |

The planning branch was created at the exact baseline commit, so switching to it did not check out different file content or absorb the untracked `CLAUDE.md`. No commit or push is authorized.

Tracked GitHub Actions do not auto-deploy on a push to `main`. Push and pull-request workflows run validation, CodeQL, secret scanning, and the optional private deploy guard. The canary deploy workflow is `workflow_dispatch` only, tag pushes create a draft release after checks, and Pages deployment is exposed only through the guarded local script. A Cloudflare Pages Git integration configured outside this repository cannot be proved or disproved from the repository and must be checked separately before any future merge to `main`.

## Fixed LOC measurement

The metric is physical newline count from tracked files only. It deliberately counts blank lines and comments and uses the same file set and category priority before and after. Untracked files, ignored `pages-dashboard/dist/`, ignored `pages-dashboard/coverage/`, `.git/`, `node_modules/`, caches, and files outside the repository are never part of the measurement.

The whole-repository total is reproduced with:

```bash
git ls-files -z | xargs -0 wc -l
```

The fixed category priority is:

1. generated/lock/vendor artifacts;
2. whole-file prompt or prompt-adjacent protection;
3. tests, fixture support, benchmarks, and smoke checks;
4. migrations;
5. documentation;
6. contracts, schemas, configuration examples, OpenAPI, and infrastructure specs;
7. CI/build/deploy metadata;
8. handwritten product code;
9. handwritten operational tooling;
10. examples.

The exact path rules are:

- Generated/lock/vendor: both `package-lock.json` files, `cloudflare/connector-registry/services.json`, `docs/SERVICE_API_INDEX.html`, `docs/BENCHMARK_COST_PROFILE.md`, and `examples/openapi-sdk-ts/src/generated/**`.
- Prompt/prompt-adjacent whole files: `docs/AGENT_CONNECTOR_PLAYBOOK.md`, `docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md`, `examples/ai-summary-to-slack/run.sh`, `cloudflare/workers/workflow/src/connectors/openai.ts`, `cloudflare/workers/workflow/src/connectors/google_ai.ts`, `cloudflare/workers/workflow/src/handlers/http/openai_chat.ts`, and `cloudflare/shared/route_validation.ts`. Prompt-bearing test/fixture files remain entirely in the already-excluded test category but are separately hash-protected below.
- Tests/fixtures/bench/smoke: `cloudflare/scripts/test_*.ts`, `cloudflare/scripts/lib/connector_test_harness.ts`, `cloudflare/scripts/smoke_*`, `cloudflare/scripts/bench_*`, `pages-dashboard/src/**/*.test.{ts,tsx}`, and `pages-dashboard/src/setupTests.ts`.
- Migrations: `cloudflare/migrations/**`.
- Documentation: tracked Markdown/text/license material outside higher-priority groups, including root docs, `docs/**`, `cloudflare/docs/**`, package READMEs, example READMEs, and `pages-dashboard/README.md`.
- Contracts/schemas/config: `cloudflare/contracts/**`, `cloudflare/schemas/**`, `cloudflare/config/**`, `cloudflare/openapi.json`, and `infra/**`.
- CI/build/deploy metadata: `.github/**`, ignore files, `.gitleaks.toml`, package manifests, TypeScript/Vite/ESLint configuration, Wrangler JSONC, and example/production environment files.
- Handwritten product: non-test/non-prompt source under `cloudflare/workers/**`, `cloudflare/shared/**`, `pages-dashboard/src/**`, `pages-dashboard/index.html`, and `packages/*/src/**`.
- Handwritten operational tooling: remaining `cloudflare/scripts/**` plus `pages-dashboard/scripts/deploy-production.sh`.
- Examples: remaining executable/source files under `examples/**`.

These rules are frozen before implementation. A later result must report both the whole-repository delta and the handwritten product/tooling delta. Changing a category after seeing results invalidates the attempt.

## Baseline LOC table

| Category | Files | Physical lines | Reducible/claimable? |
| --- | ---: | ---: | --- |
| Handwritten product code | 73 | 12,332 | Yes, subject to contracts and prompt exclusions |
| Handwritten operational tooling | 16 | 2,154 | Yes, subject to behavior preservation |
| Tests, fixture support, benchmarks, smoke checks | 28 | 4,360 | No |
| Prompt and prompt-adjacent whole files | 7 | 567 | No |
| Contracts, schemas, configs, OpenAPI, infra specs | 9 | 995 | No |
| Generated, lock, and vendored artifacts | 6 | 11,369 | No |
| Documentation | 54 | 2,594 | No |
| CI/build/deploy metadata | 39 | 1,406 | No |
| Migrations | 5 | 90 | No |
| Examples | 3 | 56 | No |
| **Total** | **240** | **35,923** | Fixed whole-repository denominator |
| **Reducible product + tooling baseline** | **89** | **14,486** | Fixed savings denominator |

Generated/lock/vendor lines, tests, fixtures, prompts, docs, contracts, schemas, migrations, examples, and CI metadata may still change when independently required for correctness, but their deletion or movement can never be claimed as production savings.

## Architecture inventory

### Runtime components

- `workers/api` is the public ingress adapter. It applies CORS, token/HMAC authorization, best-effort per-isolate rate limiting, route and manifest lookup, payload validation, idempotency, sync service dispatch, async queue enqueueing, legacy endpoint alerting, and manual schedule enqueueing.
- `workers/workflow` is the internal route/schedule dispatcher. It resolves Secrets Store bindings, validates enabled configuration, authenticates internal callers, runs HTTP or cron handlers, converts handler errors to the public error contract, and emits structured logs.
- `workers/queue-consumer` records run start/success/failure, invokes the workflow service, writes dead letters, applies retry classification, and acknowledges or retries messages.
- `workers/scheduler` maps Cloudflare cron expressions to enabled manifest schedules and enqueues workspace-scoped scheduled tasks.
- `workers/ops-dashboard` contains two distinct surfaces in one entrypoint: a Worker-served inline HTML/CSS/JavaScript dashboard and the authenticated ops API backed by D1, Queue, manifest, OAuth, audit, and workflow-service bindings.
- `pages-dashboard` is a separate React/Vite Pages application. It has its own query caching, filters, token storage, charts, run comparison, and visual output and calls the documented `/api/ops/*` API shape.
- `packages/core-runtime` owns extracted manifest and enablement algorithms; `cloudflare/shared/manifest.ts` and `task_enablement.ts` adapt Cloudflare types/default registries to that core.
- `packages/handler-sdk` and `packages/recipes-example` are explicit ecosystem extension points even though the current Worker entrypoints do not import them.

### Execution and persistence

- Async HTTP: `POST /api/{route}` -> ingress/auth/validation/idempotency -> Queue -> queue consumer -> workflow `/run-async` -> handler -> D1 run result/dead letter.
- Sync HTTP: `POST /api/{route}` -> ingress/auth/validation/idempotency -> workflow `/run-sync` -> handler -> JSON or `http_passthrough` response.
- Scheduled: Cloudflare cron or manual enqueue -> Queue -> queue consumer -> workflow cron handler.
- D1 tables are `runs`, `idempotency_keys`, `cursor_state`, `dead_letters`, `replay_lineage`, `oauth_tokens`, and `audit_events`. Workspace IDs participate in runs, dead letters, OAuth tokens, audit events, and dashboard filters.
- Applied migration marker is `0004_audit_events.sql`; migration order and destructive-statement guards are contractual.

## Externally observable contracts

### Routes and status behavior

- API Worker: `GET /api/health`; `OPTIONS /api/*`; `POST /api/{route_id}`; `POST /api/dev/cron/{schedule_id}`. Legacy `/api/r/...` forms are deliberately blocked with `404` and optional alerting.
- Workflow Worker: `GET /health`; authenticated `GET /health/config`; authenticated `POST /run-sync`; authenticated `POST /run-async`.
- Ops Worker public assets: `GET /health`, `/`, `/favicon.svg`, `/favicon.ico`, `/app.js`, and `/api/app.js`.
- Ops Worker authenticated reads: `/api/meta`, `/api/extensions`, `/api/templates`, `/api/oauth-tokens`, `/api/audit-events`, `/api/summary`, `/api/catalog`, `/api/runs`, `/api/run-detail/{traceId}`, `/api/dead-letters`, `/api/replays`, `/api/route-detail/{route}`, `/api/cron-detail/{schedule}`, `/api/timeline`, `/api/timeline-detail`, `/api/error-clusters`, and `/api/secrets-health`.
- Ops Worker authenticated writes: `POST /api/oauth-tokens/upsert`, `/api/retry/{traceId}`, `/api/replay/{traceId}`, and `/api/cron-run/{scheduleId}`; write access must remain stricter than read access.
- The documented/OpenAPI/Pages stable shape is `/api/ops/*`, while the checked-in ops Worker directly dispatches `/api/*`. No checked-in Worker route or Pages proxy explains that prefix rewrite. Before implementation, characterize the deployed/proxy contract or explicitly test both forms; do not silently “fix” or collapse it during LOC work.
- Preserve API outcomes: `202` for accepted async/manual/replay work and duplicates; `400` for malformed/invalid payloads; `401` for missing/invalid auth or signatures; `403` for read-token attempts at writes; `404` for unknown routes/resources/legacy endpoints; `405` for unsupported methods; `409` for disabled/non-failed replay conflicts; `422` for malformed dead-letter payloads; `429` for rate limits; and existing `500` error contracts.

### Route and schedule catalog

- Preserve all 21 route IDs in `cloudflare/shared/routes.ts`, their sync/async mode, `flowPath`, and `wrapBody` values.
- Preserve all six schedule IDs, cron expressions, targets, time zones, and enabled states in `cloudflare/shared/schedules.ts`.
- Preserve handler-registry coverage, config-manifest mode, route allow/deny gates, compatibility JSON, documentation, and OpenAPI behavior.

### Configuration and security

Preserve the meaning and lookup order of all current bindings and environment variables, including:

- core bindings: `DB`, `AUTOMATION_QUEUE`, `WORKFLOW_SERVICE`, `ENV_NAME`;
- manifest/workspace: `MANIFEST_MODE`, `ROUTES_CONFIG_JSON`, `SCHEDULES_CONFIG_JSON`, `ENABLED_HTTP_ROUTES`, `DISABLED_HTTP_ROUTES`, `DEFAULT_WORKSPACE_ID`;
- ingress: `API_INGRESS_TOKEN`, `API_HMAC_SECRET`, `API_HMAC_MAX_SKEW_SECONDS`, `API_RATE_LIMIT_PER_MINUTE`, `API_ROUTE_LIMITS_JSON`;
- internal/RBAC: `WORKFLOW_INTERNAL_TOKEN`, `OPS_DASHBOARD_READ_TOKEN`, `OPS_DASHBOARD_WRITE_TOKEN`, `OPS_DASHBOARD_TOKEN`, `OPS_DASHBOARD_EXTENSIONS_JSON`;
- connector and alert secrets in `Env` and Wrangler configuration, including Google Chat aliases, Slack, GitHub, OpenAI, Stripe, Notion, HubSpot, Google AI/lead normalization, fanout, and cleanup signing.

Keep fail-closed behavior when ingress, internal workflow, or ops tokens are absent. Keep HMAC timestamp skew, signature normalization, secret redaction, audit logging boundaries, replay enablement checks, idempotency, Queue retry behavior, and workspace filters unchanged.

### Telemetry, performance, platform, visual, and artifact contracts

- Preserve structured runtime log fields and redaction: level, event, trace/workspace/route/schedule identifiers, status, details, and timestamp.
- Preserve D1 query ordering, limits, time-window clamps, workspace predicates, duration/percentile semantics, error-cluster normalization, replay lineage ordering, and cron next-run behavior.
- Preserve retry status lists, Retry-After handling, backoff limits, and jitter semantics. Do not replace bounded response reads with unbounded reads or add request-scoped global state.
- Preserve Worker compatibility behavior and current bindings. Current installed review references are `@cloudflare/workers-types 5.20260714.1`, TypeScript `7.0.2`, and Wrangler `4.110.0`; external current-doc/type retrieval was prohibited during discovery and must be refreshed before implementation if network use is approved.
- Preserve both dashboards' routes, controls, filters, URL/local-storage behavior, charts, tables, inline script endpoint, responsive behavior, CSS, fonts, copy, and accessible labels. Moving inline HTML/CSS/JS to another file is zero savings. Generating it from the Pages build is prohibited generated-code substitution and would remove the Worker-only deployment mode.
- Preserve generated SDK shape, service catalog/index, benchmark report format, OpenAPI, scaffold output, deploy/bootstrap plans, and error-report output. Regenerated artifacts never count as savings.

## Public exports and extension points

- Preserve `packages/core-runtime/src/index.ts` exports for types, manifest, and enablement.
- Preserve `packages/handler-sdk/src/index.ts` handler/context/registration types and registration functions.
- Preserve `packages/recipes-example/src/index.ts` example route/schedule exports.
- Preserve documented route/schedule registries and connector contract identifiers.
- Treat direct exported connector/helper modules as externally consumable unless reachability and versioning evidence affirmatively prove otherwise. An internal `rg` result alone is insufficient for deletion.

## Prompt inventory and immutable preservation

Whole-file SHA-256 is used as a deliberately conservative byte baseline. Every implementation checkpoint and final verification must run `shasum -a 256` on this exact list and compare all values. A hash change is an immediate abort, even if the diff appears to be formatting or a type-only edit.

| File | SHA-256 | Protected semantics |
| --- | --- | --- |
| `docs/AGENT_CONNECTOR_PLAYBOOK.md` | `0a05b61079c29a7a5e9dfd425780a932f4528232a63201d0f31d1c89ac556db8` | Agent prompt template and instructions |
| `docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md` | `85e13d132cec0307d6734e116f811a1f8989d0ba8b5feaaa8231eac0cf4ae0d3` | Reusable agent prompt |
| `examples/ai-summary-to-slack/run.sh` | `345944192cc3c6af1baa118e04af3efba522ccb93764412ddfb015a9467fb70f` | System/user example prompt bytes and ordering |
| `cloudflare/workers/workflow/src/connectors/openai.ts` | `6c7af4321f11d4bedbafe935b5b8b423ee665156b741749b488c6e82764280d0` | Optional system message followed by user message, model payload, response schema |
| `cloudflare/workers/workflow/src/connectors/google_ai.ts` | `ae2d576f34907a1d85b711c50137e78142c370732203591f34d3b4c4f5162dd5` | User role/content structure, generation configuration, response schema |
| `cloudflare/workers/workflow/src/handlers/http/openai_chat.ts` | `17e8b49c42e6f0e5f40cb05fb7f110198d6888e12771ddc6312a584cda3e93c6` | Prompt defaults, trimming, system-prompt forwarding, model defaults |
| `cloudflare/shared/route_validation.ts` | `0bd45541df87801691e51acc8d3e341a62ad0fce13f0863471b1b0a6c2547e71` | Prompt-adjacent request validation/schema behavior |
| `cloudflare/scripts/test_handler_fixtures.ts` | `7808c946aff97d5a17e8b4215af7456db4386d760d4be05ffcb5a71af6b61804` | Prompt fixtures and message-order assertions |
| `cloudflare/scripts/test_route_fixtures.ts` | `97ec9d9d658b96a7902c82174cc5a61f8056a09f9370814655b76f081b86d58e` | Prompt request fixture |
| `cloudflare/scripts/test_connector_harness.ts` | `fbf114e5c3083185711ecb3a483022e6bf07baaf7be9ecfba64bc66fcc2e3f1a` | Connector prompt fixture and response schema expectations |
| `cloudflare/scripts/smoke_workflow_handlers.ts` | `60cd8241ea3df529b7da97d923b9dbebe6e824543fe596bd3d4f8eebb2548272` | Smoke prompt fixture |
| `cloudflare/scripts/test_e2e_runtime.ts` | `6835033373c868e214f08501977d8439ef9d548e0e81a0dfe8ddb89cc7c03d84` | End-to-end prompt fixture and queued message structures |
| `cloudflare/scripts/bench_route_throughput.ts` | `637ae07cab812f90496689d29c0133ddd42509c15878265d9773d5c941b3bec9` | Benchmark prompt fixture |

The OpenAI connector must continue to omit the system message when `systemPrompt` is falsy and otherwise place it before the user message. The Google AI connector must continue to send the same user-role contents and generation configuration. No shared request builder may touch these files or alter JSON property ordering/interpolation semantics. Prompt lines are excluded from both the reducible baseline and savings.

## Candidate reduction clusters

Estimates are physical-line ranges, not targets to game. “Gross” is old code expected to disappear; “new” is readable canonical code/tests needed to preserve behavior; “net” is gross minus new production/tooling code. New characterization tests and audit tooling are reported separately and are not used to reduce the production target.

| Cluster | Files | Category/evidence | Gross deletion | New canonical code | Estimated net | Risk | Confidence |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Handler input/context/env normalization | Non-prompt HTTP handlers, cron cleanup, `workflow/src/lib/env.ts`, `workflow/src/lib/payload.ts`, handler registries | 15+ local object guards, 10+ env-string readers, 11 context aliases, and repeated missing-context checks already overlap with existing env/payload helpers | 320-410 | 90-120 | 220-290 | Medium | High |
| Common Worker security/config/path plumbing | API, workflow, ops dashboard, `shared/task_enablement.ts`, new or existing shared helper | Exact route-set/enablement duplication, three timing-safe string loops, two route-limit parsers, repeated Secrets Store guards, and six identical path decoders | 160-220 | 70-90 | 90-130 | High because auth/status behavior is observable | High for duplication, medium for final shape |
| Ops query/result canonicalization | `workers/ops-dashboard/src/index.ts` backend section only | Route/cron detail queries and metrics, run row projections/mapping, status counting, time/workspace query context, replay/result shaping repeat with the same D1 schema | 300-420 | 140-190 | 160-230 | Medium-high | Medium |
| Pages request/filter plumbing | `pages-dashboard/src/lib/api.ts`, `pages-dashboard/src/App.tsx` | GET and replay request/error logic duplicate; URL and local-storage filter parsing duplicate normalization; repeated query refresh wiring can be reduced only when the result stays clearer | 150-220 | 70-90 | 80-130 | Medium | High for API/filter helpers; low for broader React abstraction |
| Operational guard/config inventory | `preflight.mjs`, `deploy_guard.mjs`, `doctor.mjs`, bootstrap/init/deploy path lists where exact behavior matches | Wrangler/config path lists and placeholder scanning are repeated across scripts | 120-170 | 50-70 | 70-100 | Low-medium | Medium |
| Core type/adapter convergence | `packages/core-runtime/src/types.ts`, `cloudflare/shared/types.ts`, `manifest.ts`, `task_enablement.ts` | Route/schedule shapes and adapter types overlap; only type aliases/re-exports that retain public exports are acceptable | 60-90 | 35-50 | 25-40 | Medium | Medium |
| Proven obsolete fallback branch | `pages-dashboard/src/lib/api.ts` | `FALLBACK_API_BASE_URL` is a private constant fixed to `""`; its branch is statically unreachable and has no config, export, route, docs, or external loader | 6-8 | 0 | 6-8 | Low | High |
| **Total defensible range** |  | Overlap must be deducted during implementation | **1,116-1,538** | **455-610** | **660-930** |  |  |

Do not stack overlapping estimates. Each implementation commit must identify the deleted owner and the canonical replacement, then recompute the fixed whole-tree and product/tooling LOC metrics.

## Dead-code evidence and deletion policy

### Affirmatively proposed dead code

`pages-dashboard/src/lib/api.ts` contains the only deletion currently supported as independently dead: `FALLBACK_API_BASE_URL` is a non-exported literal empty string, the only branch that uses it requires it to be truthy, no environment/config path can mutate it, and repository-wide search finds no other reference. Removing the unreachable branch preserves the one-element base URL list. Characterize the request URLs before deleting it.

### Unverified candidates that must not be deleted under this plan

| Candidate | Internal reachability evidence | Why deletion is not yet justified |
| --- | --- | --- |
| `cloudflare/shared/routes.ts` `routeMap`/`getRoute` | No internal callers; only definition found | `getRoute` is exported from a canonical registry module and may be a direct-source extension API |
| `workflow/src/connectors/clickup.ts` | No handler import, route registration, runtime connector spec, fixture, smoke, or build-entry call site; ClickUp exists only in the generic service-doc catalog | The functions are exported from public OSS source and may support private overlays; owner/API evidence is required |
| `workflow/src/connectors/google_chat.ts` | No internal caller; current chat handlers perform their own transport | The function is exported and the chat connector is a documented runtime concept; direct-source consumers cannot be ruled out |
| `workflow/src/connectors/google_ai.ts` | No current handler caller; Google AI is referenced by connector/config docs | It is prompt-bearing and therefore immutable regardless of reachability |
| `packages/handler-sdk` and `packages/recipes-example` | No current Worker entrypoint imports | Package manifests, roadmap, migration plan, and public ecosystem intent make them explicit extension points |

Before any future dead-code proposal, require all of: import/call-site search, handler/route/schedule/manifest/connector registration search, Wrangler and build entrypoint inspection, tests/fixtures/smoke inspection, docs/upgrade/versioning inspection, package export/public direct-source assessment, and dynamic/reflection loading assessment. If any dimension is unresolved, classify it unverified and claim zero savings.

## Proposed canonical owners

1. **Handler input and environment helpers.** Extend the existing `workflow/src/lib/env.ts` and `payload.ts` with small readable helpers such as record narrowing, required context env, string lookup, and scalar metadata normalization. Non-prompt handlers import them. Do not create a handler factory, generic DSL, or table that hides route-specific validation or typed result contracts.
2. **Shared security/config primitives.** Give route-set parsing/enablement, exact current constant-time string comparison semantics, route-limit parsing, and Secrets Store value resolution one canonical owner under `cloudflare/shared` when the semantics are byte-for-byte equivalent. Security improvements that change outcomes belong in a separate change, not this LOC refactor.
3. **Ops backend mappers/query contexts.** Keep SQL explicit but centralize identical run projections, status-to-count conversion, scope metrics, time/workspace bindings, and path parameter decoding. Do not build a generic SQL DSL or merge distinct endpoints merely because their rows look similar.
4. **Pages HTTP request core.** Generalize the existing typed request function to support GET/POST and one error path, then keep endpoint wrappers explicit. Centralize filter normalization from URL/storage without changing defaults, limits, key names, history behavior, or persistence precedence.
5. **Operational project-file inventory.** Put stable Wrangler/infra path lists and placeholder scanning in one small `.mjs` helper used by preflight/doctor/deploy guard. Keep strict/warn messages, exit codes, and deploy approval scripts unchanged.
6. **Core/shared type aliases.** Prefer aliases or `satisfies`-checked adapters over duplicated route/schedule shapes only when package exports and Cloudflare-specific `Env`/task fields remain intact.

## Code independently removable without abstraction

- The private, permanently empty `FALLBACK_API_BASE_URL` compatibility branch: estimated 6-8 lines after characterization.
- No dashboard, connector module, package, route, handler, schedule, migration, config, generated artifact, test, fixture, document, or prompt is independently removable on current evidence.

## Required characterization and contract tests before implementation

1. Add or strengthen tests for every current API/Workflow/Ops route method and status code listed above, including CORS, fail-closed auth, read-versus-write RBAC, HMAC failure reasons, disabled routes, replay conflicts, malformed dead letters, and unknown paths.
2. Add direct tests for shared route-set parsing, route enablement, rate-limit JSON normalization, token comparison results, Secrets Store string resolution, and missing binding behavior before moving owners.
3. Add table-driven tests for non-prompt handler record coercion, env alias order, missing env/context errors, metadata normalization, and unchanged typed result shapes.
4. Add D1-mock characterization for route detail, cron detail, runs, timeline detail, summary, workspace filtering, status counting, duration/p95, replay lineage, and audit event responses before consolidating ops mappings.
5. Add a fail-closed prompt integrity check using every SHA-256 above. The test must report the changed file and expected/actual hash and must run in `release:check` without rewriting any prompt file.
6. Characterize both dashboard deployment modes separately. Test the Worker root HTML, `/app.js`, inline-script boot guard, key controls/labels, and API paths. Keep existing React component/API tests and add any missing filter-storage/request-method coverage.
7. Resolve or document the `/api/*` versus `/api/ops/*` prefix contract with deployment/proxy evidence. If the repository must support both directly, lock both forms in tests before refactoring dispatch.
8. Lock operational script stdout labels, strict/warn exit codes, placeholder line reporting, manifest/handler coverage, and deploy approval behavior before sharing script helpers.
9. Preserve package export/type checks for `core-runtime`, `handler-sdk`, and recipes. Add compile-only consumer fixtures if direct-source imports are considered supported.
10. Run secret scanning and verify no new real account IDs, database IDs, store IDs, tokens, private URLs, or credentials appear.

Tests and audit tooling are tracked and counted separately. They are not deducted from production savings and are never deleted to improve the final number.

## Baseline verification state

| Command/check | Discovery result | Notes |
| --- | --- | --- |
| `cd cloudflare && npm run typecheck` | PASS | TypeScript 7.0.2, no emit |
| `cd cloudflare && npm run preflight` | PASS with expected public-placeholder warnings | HTTP and cron registry coverage passed |
| `cd cloudflare && npm run migrations:guard:strict` | PASS | Four migrations, applied through `0004_audit_events.sql` |
| `cd cloudflare && npm run deploy:guard` | PASS in warn mode | Reported only `REPLACE_WITH_*` public placeholders |
| `cd cloudflare && tsc --noEmit --noUnusedLocals --noUnusedParameters` | PASS | No compiler-confirmed unused local/parameter |
| `cd cloudflare && npm run release:check` | BLOCKED before the suite | Local `tsx` binary is missing and `tsx` is not a declared devDependency; allowing `npx` to download it was prohibited |
| Cloudflare TS fixture/contract/e2e/smoke commands | SKIPPED | Same missing-local-`tsx` blocker; no install/network fallback allowed |
| `cd pages-dashboard && npm run lint` | PASS | ESLint 10.7.0, no cache option enabled |
| Direct Pages app/node TypeScript checks with `--noEmit --incremental false` | PASS | Avoided build-info/artifact writes |
| `cd pages-dashboard && vitest run --no-cache --no-coverage` | PASS | 4 files, 20 tests |
| `cd pages-dashboard && npm run build` / `release:check` | SKIPPED | They rewrite ignored `dist/` and `coverage/`, prohibited in read-only discovery |
| `npm run smoke:ops` | SKIPPED | Applies local D1 migrations, writes local Wrangler state/temp files, and launches a server |
| `npm run test:service-registry-urls` | SKIPPED | Contacts external documentation hosts |
| CI CodeQL/gitleaks/release/canary workflows | SKIPPED | CI/external execution; canary/deploy mutations not authorized |
| External current Cloudflare docs/types retrieval | SKIPPED | Discovery prohibited external service contact; installed types/config were inspected instead |
| Worktree status after checks | CLEAN for tracked/staged files | Only original untracked `CLAUDE.md` plus this untracked goal file on the planning branch |

The missing local `tsx` is a pre-implementation blocker, not a reason to let `npx` download code implicitly. Before implementation, obtain explicit dependency-install/network authorization, make the test runner reproducible, run the full current baseline, and record results. Any dependency/lockfile change is ancillary and contributes zero claimed savings.

## Post-change verification matrix

Run from a clean implementation worktree with installed lockfile dependencies and no production credentials:

```bash
cd cloudflare
npm run release:check
npm run test:connector-registry
npm run test:service-registry
npm run smoke:handlers

cd ../pages-dashboard
npm run release:check
```

Also run:

- the new prompt SHA-256 integrity check;
- the new route/status/security/ops/handler/script characterization tests;
- `tsc --noEmit --noUnusedLocals --noUnusedParameters` for the Cloudflare source;
- package consumer/type fixtures for public exports;
- `npm run smoke:ops` only against local Wrangler/D1 state after confirming it cannot reach production;
- `npm run test:service-registry-urls` only when external read access is approved;
- gitleaks using `.gitleaks.toml` or the repository's CI secret-scan workflow;
- both fixed LOC measurements and `git diff --check`;
- a repository search confirming every remaining handler/connector/helper is registered, imported, tested, documented as an extension, or explicitly classified unverified;
- local browser verification of both dashboards at desktop and narrow mobile widths if visual code changes at all.

Do not run deploy commands, remote migrations, remote smoke tests, production health checks, or Cloudflare resource mutations as part of LOC verification.

## Phased implementation and rollback plan

Each phase is a separately reviewable commit with a clean baseline, full applicable checks, prompt hashes, and fixed LOC delta. Stop immediately on behavior drift.

1. **Prerequisite characterization.** Make the local test runner reproducible with explicit approval, establish a full green baseline, add prompt integrity and missing contract tests. Rollback point: characterization-only commit; production LOC unchanged.
2. **Low-risk dead branch and Pages request core.** Remove only the proven empty fallback branch, unify GET/POST error handling, and centralize filter normalization. Rollback point: Pages-only commit with 20+ tests, build, and URL/storage/request snapshots.
3. **Non-prompt handler helpers.** Reuse canonical env/payload helpers in small handler batches, grouped by connector family. Do not touch hashed prompt files. Rollback after each family with handler fixtures and connector harness green.
4. **Shared Worker primitives.** Replace exact duplicates for route enablement, token comparison, route-limit parsing, path decoding, and secret resolution one behavior at a time. Rollback point after API security tests, workflow tests, and ops RBAC tests.
5. **Ops backend query/mapping.** Characterize then consolidate run projections, status counts, route/cron detail metrics, and time/workspace query setup. Do not edit inline dashboard UI in this phase. Rollback point after each endpoint family with response snapshots/contract assertions.
6. **Operational tooling helpers.** Share config inventories and placeholder scanning while preserving stdout/exit codes. Rollback point with script fixture tests and public-placeholder behavior.
7. **Core/shared type convergence.** Apply only if the diff remains simpler and public compile fixtures pass. Abort this phase if aliases/casts become harder to understand or save fewer than 25 net lines.
8. **Integration audit.** Run the full verification matrix, both dashboards, secret scan, prompt hashes, dead-code reachability audit, and fixed LOC commands. Produce the final report. No deploy, commit squashing, or push without separate owner instruction.

## Anti-reward-hacking audit

Reject the result if any of the following occurs:

- inclusion/exclusion rules or the baseline file set changes after results are known;
- code is minified, one-lined, semicolon-packed, newline-stripped, code-golfed, binary-encoded, hidden in opaque tables, or made harder to debug;
- code is moved to another file/tree/repository/dependency and counted as deletion;
- source is replaced with generated output or a runtime generator to lower handwritten LOC;
- a dependency is added mainly to replace local code;
- tests, fixtures, snapshots, docs, types, schemas, contracts, prompts, examples, migrations, lockfiles, generated artifacts, error handling, telemetry, security, compatibility, or extension points are removed or weakened;
- the inline dashboard is deleted in favor of Pages, Pages is deleted in favor of inline HTML, or either is built/generated from the other for LOC credit;
- prompt bytes, message ordering, interpolation, defaults, examples, validation, schemas, or model instructions change;
- newly added characterization tests or audit tooling are subtracted from reported production savings;
- a formatting-only diff accounts for any claimed savings.

The final audit must show `git diff --numstat`, fixed categorized before/after counts, and a manual explanation for every file with a production LOC decrease. Moving code between files contributes zero until whole-repository net deletion proves otherwise.

## Abort and reject criteria

Abort the entire implementation if:

- the full pre-change Cloudflare and Pages release checks cannot be made green in a clean, reproducible environment;
- prompt hashes differ at any point;
- the `/api/*` versus `/api/ops/*` deployment contract cannot be characterized for changed code;
- a change alters routes, schedules, status codes, error bodies, headers, persistence, workspace isolation, replay/idempotency semantics, secret lookup order, logs, performance-sensitive behavior, or either dashboard;
- a proposed “dead” export lacks affirmative public-API and dynamic-loading evidence;
- required characterization would need production data or production mutation;
- net honest product/tooling savings fall below **500 lines** after overlap/new helper code is counted;
- any cluster saves fewer lines than its readable canonical implementation costs or makes the code less local and harder to debug;
- unrelated user work would be overwritten, staged, committed, or absorbed;
- secret scanning or public-export checks reveal private values.

Reject individual abstractions even if the overall plan continues when they create a generic framework for one use, weaken route-specific types, hide SQL, merge semantically different provider errors, or merely relocate code.

## Required final report format

The implementation closeout, if later authorized, must report:

1. baseline and final commit IDs, branches, and worktree state;
2. fixed whole-repository and category LOC tables before/after;
3. **total net handwritten production LOC reduced** and **total net handwritten tooling LOC reduced**;
4. **dead code removed**, with complete reachability/public-API evidence per item;
5. **code abstracted**, naming the old owners, canonical owner, gross deletion, new code, and net savings;
6. **code independently removable**, including items deliberately left because evidence was insufficient;
7. prompt preservation evidence with all expected/actual SHA-256 values and unchanged ordering/interpolation statements;
8. no-dead-code evidence for every remaining apparently unused export/extension point;
9. full command-by-command test, typecheck, lint, build, contract, fixture, smoke, security, and browser evidence, including skips and reasons;
10. confirmation that no deploy, production mutation, remote migration, secret change, or external write occurred;
11. remaining risks, rejected abstractions, and the exact rollback commit for each phase.

The headline number must be the fixed net product/tooling reduction. Generated files, locks, prompts, tests, docs, contracts, migrations, examples, formatting, and moved code must never appear in the claimed savings.
