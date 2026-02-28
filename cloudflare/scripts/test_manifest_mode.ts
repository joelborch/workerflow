import assert from "node:assert/strict";

import { ROUTES } from "../shared/routes";
import { SCHEDULES } from "../shared/schedules";
import { resolveRuntimeManifest } from "../shared/manifest";
import { checkTaskReplayEnablement } from "../shared/task_enablement";
import type { QueueTask } from "../shared/types";

function run() {
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

  const customTask: QueueTask = {
    kind: "scheduled_job",
    traceId: "trace-custom",
    scheduleId: "custom_hourly",
    enqueuedAt: new Date().toISOString()
  };

  const replayCheck = checkTaskReplayEnablement(customTask, {}, {
    routes: config.routes,
    schedules: config.schedules
  });
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

  console.log("manifest mode tests passed");
}

run();
