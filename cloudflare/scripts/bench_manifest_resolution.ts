import { performance } from "node:perf_hooks";

import { resolveRuntimeManifest } from "../shared/manifest";
import { checkTaskReplayEnablement } from "../shared/task_enablement";

function run() {
  const iterations = 50_000;
  const start = performance.now();

  let enabledCount = 0;
  for (let i = 0; i < iterations; i += 1) {
    const manifest = resolveRuntimeManifest({});
    const check = checkTaskReplayEnablement(
      {
        kind: "http_route",
        traceId: `trace-${i}`,
        routePath: manifest.routes[i % manifest.routes.length]?.routePath,
        enqueuedAt: new Date().toISOString()
      },
      {},
      manifest
    );

    if (check.enabled) {
      enabledCount += 1;
    }
  }

  const elapsedMs = performance.now() - start;
  const perSecond = Math.round((iterations / elapsedMs) * 1000);
  console.log(`manifest benchmark: iterations=${iterations} elapsedMs=${elapsedMs.toFixed(2)} opsPerSec=${perSecond} enabled=${enabledCount}`);
}

run();
