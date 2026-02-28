import {
  recordRunFailure,
  recordRunStart,
  recordRunSuccess,
  writeDeadLetter
} from "../../../shared/db";
import { runtimeLog } from "../../../shared/logger";
import type { Env, QueueTask } from "../../../shared/types";

function isRetryableError(errorText: string) {
  const normalized = errorText.toLowerCase();

  const nonRetryablePatterns = [
    /is required/,
    /missing required/,
    /unauthorized/,
    /forbidden/,
    /invalid .*credentials/,
    /invalid_grant/,
    /no .* found in payload/
  ];

  if (nonRetryablePatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return true;
}

export default {
  async queue(batch: MessageBatch<QueueTask>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const task = message.body;
      try {
        runtimeLog({
          level: "info",
          event: "queue.task_started",
          traceId: task.traceId,
          workspaceId: task.workspaceId,
          routePath: task.routePath,
          scheduleId: task.scheduleId,
          status: "started"
        });
        await recordRunStart(env.DB, task);

        const response = await env.WORKFLOW_SERVICE.fetch("http://workflow.internal/run-async", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(task)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`workflow failed: ${response.status} ${errorText}`);
        }

        const payload = await response.text();
        await recordRunSuccess(env.DB, task.traceId, payload);
        runtimeLog({
          level: "info",
          event: "queue.task_succeeded",
          traceId: task.traceId,
          workspaceId: task.workspaceId,
          routePath: task.routePath,
          scheduleId: task.scheduleId,
          status: "succeeded"
        });
        message.ack();
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);
        await recordRunFailure(env.DB, task.traceId, errorText);
        await writeDeadLetter(env.DB, task.traceId, task, errorText, task.workspaceId);
        runtimeLog({
          level: "error",
          event: "queue.task_failed",
          traceId: task.traceId,
          workspaceId: task.workspaceId,
          routePath: task.routePath,
          scheduleId: task.scheduleId,
          status: "failed",
          details: {
            error: errorText
          }
        });
        if (isRetryableError(errorText)) {
          message.retry();
        } else {
          message.ack();
        }
      }
    }
  }
};
