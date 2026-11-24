import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { RUNTIME_CONNECTOR_SPECS } from "../shared/connector_registry";
import { decodePathParameter } from "../shared/http";
import { buildRuntimeLogEvent } from "../shared/logger";
import { resolveRuntimeManifest } from "../shared/manifest";
import { ROUTES } from "../shared/routes";
import { parseRouteRateLimits } from "../shared/runtime_config";
import { SCHEDULES } from "../shared/schedules";
import { isSecretsStoreBinding, timingSafeStringEqual } from "../shared/security";
import { checkTaskReplayEnablement, isRouteEnabled, parseRouteSet } from "../shared/task_enablement";
import type { QueueTask } from "../shared/types";
import { validateEnabledManifestConfig, validateTaskConfig } from "../workers/workflow/src/config_validation";
import { readEnvString, requireContextEnv } from "../workers/workflow/src/lib/env";
import { asObject, readString, toScalarMetadata, unwrapObjectBody } from "../workers/workflow/src/lib/payload";

function readJsonFile<T>(relativePath: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8")) as T;
}

function makeTask(kind: "http_route", target: string): QueueTask;
function makeTask(kind: "scheduled_job", target: string): QueueTask;
function makeTask(kind: "http_route" | "scheduled_job", target: string): QueueTask {
  return {
    kind,
    traceId: kind === "http_route" ? "trace-http" : "trace-schedule",
    ...(kind === "http_route" ? { routePath: target } : { scheduleId: target }),
    payload: {},
    enqueuedAt: new Date().toISOString()
  };
}

describe("contracts, registries, manifest, config, and helpers", () => {
  it("matches routes and schedules v1 compatibility contracts", () => {
    const routesContract = readJsonFile<typeof ROUTES>("contracts/routes.v1.json");
    const schedulesContract = readJsonFile<typeof SCHEDULES>("contracts/schedules.v1.json");

    assert.deepEqual(
      [...ROUTES].sort((a, b) => a.routePath.localeCompare(b.routePath)),
      [...routesContract].sort((a, b) => a.routePath.localeCompare(b.routePath)),
      "Route compatibility contract mismatch. Update routes.v1.json only for intentional breaking changes."
    );
    assert.deepEqual(
      [...SCHEDULES].sort((a, b) => a.id.localeCompare(b.id)),
      [...schedulesContract].sort((a, b) => a.id.localeCompare(b.id)),
      "Schedule compatibility contract mismatch. Update schedules.v1.json only for intentional breaking changes."
    );
  });

  it("validates runtime connector registry specs", () => {
    const routeIds = new Set(ROUTES.map((route) => route.routePath));
    const secretKeyPattern = /^[A-Z0-9_]+$/;

    assert.ok(RUNTIME_CONNECTOR_SPECS.length >= 6);
    const ids = RUNTIME_CONNECTOR_SPECS.map((connector) => connector.id);
    assert.equal(new Set(ids).size, ids.length, "runtime connector ids must be unique");

    for (const connector of RUNTIME_CONNECTOR_SPECS) {
      assert.ok(connector.displayName.trim().length > 0, `${connector.id}: missing displayName`);
      assert.ok(connector.docsUrl.startsWith("https://"), `${connector.id}: docsUrl must be https`);
      assert.ok(connector.routeRequirements.length > 0, `${connector.id}: expected route requirement`);

      for (const requirement of connector.routeRequirements) {
        assert.ok(routeIds.has(requirement.routePath), `${connector.id}: unknown routePath "${requirement.routePath}"`);
        assert.ok(requirement.label.trim().length > 0);
        assert.ok(requirement.requiredSecrets.length > 0);
        for (const secretKey of requirement.requiredSecrets) {
          assert.ok(secretKeyPattern.test(secretKey), `invalid secret key "${secretKey}"`);
        }
      }
    }
  });

  it("resolves legacy and config manifest modes", () => {
    const legacy = resolveRuntimeManifest({});
    assert.equal(legacy.mode, "legacy");
    assert.deepEqual(legacy.routes, ROUTES);
    assert.deepEqual(legacy.schedules, SCHEDULES);

    const customRoute = {
      routePath: "custom_ping",
      requestType: "async" as const,
      flowPath: "f/custom/ping",
      wrapBody: false
    };
    const customSchedule = {
      id: "custom_hourly",
      cron: "0 * * * *",
      enabled: true,
      target: "f/custom/hourly",
      timeZone: "UTC"
    };

    const config = resolveRuntimeManifest({
      MANIFEST_MODE: "config",
      ROUTES_CONFIG_JSON: JSON.stringify([customRoute]),
      SCHEDULES_CONFIG_JSON: JSON.stringify([customSchedule])
    });
    assert.equal(config.mode, "config");
    assert.deepEqual(config.routes, [customRoute]);
    assert.deepEqual(config.schedules, [customSchedule]);

    const replayCheck = checkTaskReplayEnablement(
      makeTask("scheduled_job", "custom_hourly"),
      {},
      { routes: config.routes, schedules: config.schedules }
    );
    assert.equal(replayCheck.enabled, true);

    assert.throws(
      () =>
        resolveRuntimeManifest({
          MANIFEST_MODE: "config",
          ROUTES_CONFIG_JSON: "{not-json}",
          SCHEDULES_CONFIG_JSON: JSON.stringify([customSchedule])
        }),
      /ROUTES_CONFIG_JSON is not valid JSON/
    );
  });

  it("validates runtime task configuration and replay enablement", () => {
    const minimalEnv = { ENV_NAME: "test" } as unknown as Record<string, unknown>;
    const expectedMissing: Array<[string, string]> = [
      ["chat_notify", "chat webhook URL"],
      ["incident_create", "chat webhook URL"],
      ["slack_message", "Slack webhook URL"],
      ["github_issue_create", "GitHub token"],
      ["openai_chat", "OpenAI API key"],
      ["stripe_payment_intent_create", "Stripe API key"],
      ["stripe_customer_upsert", "Stripe API key"],
      ["notion_database_item_create", "Notion token"],
      ["notion_database_item_get", "Notion token"],
      ["hubspot_contact_upsert", "HubSpot access token"],
      ["hubspot_deal_upsert", "HubSpot access token"],
      ["lead_normalizer", "Google AI key"]
    ];

    for (const [routePath, needle] of expectedMissing) {
      const errors = validateTaskConfig(makeTask("http_route", routePath), minimalEnv as never);
      assert.ok(
        errors.some((item) => item.includes(needle)),
        `Expected errors for ${routePath} to include "${needle}"`
      );
    }

    const okEnv = {
      ENV_NAME: "test",
      CHAT_WEBHOOK_URL: "https://chat.example/incoming",
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T000/B000/fixture",
      GITHUB_TOKEN: "fixture-github-token",
      OPENAI_API_KEY: "fixture-openai",
      STRIPE_API_KEY: "fixture-stripe",
      NOTION_TOKEN: "fixture-notion",
      HUBSPOT_ACCESS_TOKEN: "fixture-hubspot",
      GOOGLEAI_API_KEY: "mock",
      CLEANUP_SIGNING_SECRET: "cleanup-secret"
    } as never;

    for (const [routePath] of expectedMissing) {
      assert.equal(validateTaskConfig(makeTask("http_route", routePath), okEnv).length, 0);
    }

    const cleanupMissing = validateTaskConfig(makeTask("scheduled_job", "cleanup_daily"), minimalEnv as never);
    assert.ok(cleanupMissing.some((item) => item.includes("cleanup signing secret")));
    assert.equal(validateTaskConfig(makeTask("scheduled_job", "cleanup_daily"), okEnv).length, 0);

    const disabledRouteReplay = checkTaskReplayEnablement(makeTask("http_route", "chat_notify"), {
      ENABLED_HTTP_ROUTES: "lead_normalizer"
    });
    assert.equal(disabledRouteReplay.enabled, false);
    assert.ok(disabledRouteReplay.reason?.includes("disabled"));

    const disabledScheduleReplay = checkTaskReplayEnablement(makeTask("scheduled_job", "not_registered"), {});
    assert.equal(disabledScheduleReplay.enabled, false);
    assert.ok(disabledScheduleReplay.reason?.includes("not enabled"));

    const enabledManifestErrors = validateEnabledManifestConfig({
      ENV_NAME: "test",
      ENABLED_HTTP_ROUTES: "chat_notify",
      CHAT_WEBHOOK_URL: "https://chat.example/incoming",
      CLEANUP_SIGNING_SECRET: "cleanup-secret",
      GOOGLEAI_API_KEY: "mock"
    } as never);
    assert.equal(enabledManifestErrors.some((item) => item.includes('route "chat_notify"')), false);
  });

  it("checks shared runtime helpers and workflow env/payload helpers", () => {
    assert.equal(timingSafeStringEqual("token", "token"), true);
    assert.equal(timingSafeStringEqual("token", "t0ken"), false);
    assert.equal(timingSafeStringEqual("short", "longer"), false);
    assert.equal(isSecretsStoreBinding({ get: async () => "secret" }), true);
    assert.equal(isSecretsStoreBinding({ get: "secret" }), false);
    assert.equal(isSecretsStoreBinding(null), false);

    assert.deepEqual(parseRouteRateLimits(undefined), {});
    assert.deepEqual(parseRouteRateLimits("not-json"), {});
    assert.deepEqual(parseRouteRateLimits("[]"), {});
    assert.deepEqual(
      parseRouteRateLimits(
        JSON.stringify({
          route_a: { rpm: 10.9, burst: 2.8 },
          route_b: { rpm: 0, burst: 4 },
          route_c: { rpm: 5, burst: -2 },
          route_d: "invalid"
        })
      ),
      {
        route_a: { rpm: 10, burst: 2 },
        route_c: { rpm: 5, burst: 0 }
      }
    );

    assert.deepEqual(parseRouteSet(" route_a, route_b, route_a "), new Set(["route_a", "route_b"]));
    assert.equal(isRouteEnabled("route_a", { ENABLED_HTTP_ROUTES: "route_a" }), true);
    assert.equal(isRouteEnabled("route_b", { ENABLED_HTTP_ROUTES: "route_a" }), false);
    assert.equal(isRouteEnabled("route_a", { DISABLED_HTTP_ROUTES: "route_a" }), false);

    assert.equal(decodePathParameter("/api/replay/trace%20one", /^\/api\/replay\/([^/]+)$/), "trace one");
    assert.equal(decodePathParameter("/api/replay/trace/one", /^\/api\/replay\/([^/]+)$/), undefined);

    assert.equal(readEnvString({ FIRST: "  primary  ", SECOND: "fallback" }, ["FIRST", "SECOND"]), "primary");
    assert.equal(readEnvString({ FIRST: " ", SECOND: " fallback " }, ["FIRST", "SECOND"]), "fallback");
    assert.equal(readEnvString({ FIRST: 123 }, ["FIRST"]), "");
    assert.deepEqual(requireContextEnv({ env: { TOKEN: "ok" } }), { TOKEN: "ok" });
    assert.throws(() => requireContextEnv(undefined), /Execution context missing env/);
    assert.throws(
      () => requireContextEnv(undefined, "Cron execution context missing env"),
      /Cron execution context missing env/
    );

    assert.deepEqual(asObject(null), {});
    assert.deepEqual(asObject([]), {});
    assert.deepEqual(unwrapObjectBody({ body: { key: "value" } }), { key: "value" });
    assert.deepEqual(unwrapObjectBody({ body: ["not", "an", "object"] }), {});
    assert.equal(readString({ value: "  text  " }, "value"), "text");
    assert.equal(readString({ value: 42 }, "value"), "");
    assert.deepEqual(toScalarMetadata({ text: "ok", count: 2, enabled: false, nested: {}, empty: null }), {
      text: "ok",
      count: "2",
      enabled: "false"
    });
    assert.equal(toScalarMetadata({ nested: {} }), undefined);
  });

  it("redacts sensitive fields in structured runtime logs", () => {
    const event = buildRuntimeLogEvent({
      level: "info",
      event: "test.log",
      traceId: "trace-123",
      workspaceId: "default",
      routePath: "openai_chat",
      status: "queued",
      details: {
        apiKey: "super-secret-key",
        token: "secret-token",
        nested: {
          authorization: "Bearer xyz",
          safe: "value"
        }
      }
    });

    assert.equal(event.event, "test.log");
    assert.equal(typeof event.timestamp, "string");
    assert.equal((event.details as Record<string, unknown>).apiKey, "[redacted]");
    assert.equal((event.details as Record<string, unknown>).token, "[redacted]");
    const nested = (event.details as { nested: Record<string, unknown> }).nested;
    assert.equal(nested.authorization, "[redacted]");
    assert.equal(nested.safe, "value");
  });

  it("verifies prompt-integrity sha256 hashes for surviving runtime, example, and consolidated test files", () => {
    const expectedHashes: Record<string, string> = {
      "examples/ai-summary-to-slack/run.sh": "345944192cc3c6af1baa118e04af3efba522ccb93764412ddfb015a9467fb70f",
      "cloudflare/workers/workflow/src/connectors/openai.ts": "6c7af4321f11d4bedbafe935b5b8b423ee665156b741749b488c6e82764280d0",
      "cloudflare/workers/workflow/src/handlers/http/openai_chat.ts": "17e8b49c42e6f0e5f40cb05fb7f110198d6888e12771ddc6312a584cda3e93c6",
      "cloudflare/shared/route_validation.ts": "0bd45541df87801691e51acc8d3e341a62ad0fce13f0863471b1b0a6c2547e71",
      "cloudflare/scripts/smoke_workflow_handlers.ts": "60cd8241ea3df529b7da97d923b9dbebe6e824543fe596bd3d4f8eebb2548272",
      "cloudflare/tests/routes_and_schedules.test.ts": "d81641969b258b823067748cc469c14a5f972a38b540570d71208628994ef667",
      "cloudflare/tests/handlers_and_connectors.test.ts": "67cc802bc21829495316d9f802c6e9d6ea6a4c3d438a2b120fbd51f050057156",
      "cloudflare/tests/e2e_runtime.test.ts": "c8516fe520aa7d47d1962048e2e234417143d9f852cc7b4b89a853efa64f45a3"
    };

    const repositoryRoot = resolve(process.cwd(), "..");
    const mismatches: string[] = [];
    for (const [path, expected] of Object.entries(expectedHashes)) {
      const actual = createHash("sha256").update(readFileSync(resolve(repositoryRoot, path))).digest("hex");
      if (actual !== expected) {
        mismatches.push(`${path}: expected ${expected}, received ${actual}`);
      }
    }

    assert.deepEqual(mismatches, []);
  });
});
