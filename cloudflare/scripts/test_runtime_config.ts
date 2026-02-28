import assert from "node:assert/strict";

import { checkTaskReplayEnablement } from "../shared/task_enablement";
import type { QueueTask } from "../shared/types";
import { validateEnabledManifestConfig, validateTaskConfig } from "../workers/workflow/src/config_validation";

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ENV_NAME: "test",
    ...overrides
  } as unknown as Record<string, unknown>;
}

function httpTask(routePath: string): QueueTask {
  return {
    kind: "http_route",
    traceId: "trace-http",
    routePath,
    payload: {},
    enqueuedAt: new Date().toISOString()
  };
}

function scheduleTask(scheduleId: string): QueueTask {
  return {
    kind: "scheduled_job",
    traceId: "trace-schedule",
    scheduleId,
    payload: {},
    enqueuedAt: new Date().toISOString()
  };
}

function expectIncludes(haystack: string[], needle: string) {
  assert.ok(haystack.some((item) => item.includes(needle)), `Expected errors to include "${needle}"`);
}

function run() {
  const minimalEnv = makeEnv();

  const chatErrors = validateTaskConfig(httpTask("chat_notify"), minimalEnv as any);
  expectIncludes(chatErrors, "chat webhook URL");

  const chatOkEnv = makeEnv({
    CHAT_WEBHOOK_URL: "https://chat.example/incoming"
  });
  assert.equal(validateTaskConfig(httpTask("chat_notify"), chatOkEnv as any).length, 0);

  const normalizerErrors = validateTaskConfig(httpTask("lead_normalizer"), minimalEnv as any);
  expectIncludes(normalizerErrors, "Google AI key");

  const normalizerOkEnv = makeEnv({
    GOOGLEAI_API_KEY: "mock"
  });
  assert.equal(validateTaskConfig(httpTask("lead_normalizer"), normalizerOkEnv as any).length, 0);

  const cleanupMissingSecret = validateTaskConfig(scheduleTask("cleanup_daily"), minimalEnv as any);
  expectIncludes(cleanupMissingSecret, "cleanup signing secret");

  const cleanupOkEnv = makeEnv({
    CLEANUP_SIGNING_SECRET: "cleanup-secret"
  });
  assert.equal(validateTaskConfig(scheduleTask("cleanup_daily"), cleanupOkEnv as any).length, 0);

  const disabledRouteReplay = checkTaskReplayEnablement(httpTask("chat_notify"), {
    ENABLED_HTTP_ROUTES: "lead_normalizer"
  });
  assert.equal(disabledRouteReplay.enabled, false);
  assert.ok(disabledRouteReplay.reason?.includes("disabled"));

  const disabledScheduleReplay = checkTaskReplayEnablement(scheduleTask("not_registered"), {});
  assert.equal(disabledScheduleReplay.enabled, false);
  assert.ok(disabledScheduleReplay.reason?.includes("not enabled"));

  const enabledManifestErrors = validateEnabledManifestConfig(
    makeEnv({
      ENABLED_HTTP_ROUTES: "chat_notify",
      CHAT_WEBHOOK_URL: "https://chat.example/incoming",
      CLEANUP_SIGNING_SECRET: "cleanup-secret",
      GOOGLEAI_API_KEY: "mock"
    }) as any
  );

  assert.equal(enabledManifestErrors.some((item) => item.includes('route "chat_notify"')), false);

  console.log("runtime config tests passed");
}

run();
