import assert from "node:assert/strict";

import { buildRuntimeLogEvent } from "../shared/logger";

function run() {
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

  console.log("logging tests passed");
}

run();
