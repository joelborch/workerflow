import { resolveRuntimeManifest } from "../../../shared/manifest";
import { runtimeLog } from "../../../shared/logger";
import type { Env, QueueTask } from "../../../shared/types";
import { resolveWorkspaceId } from "../../../shared/workspace";

function findSchedulesByCron(cron: string, env: Env) {
  const manifest = resolveRuntimeManifest(env);
  return manifest.schedules.filter((item) => item.enabled && item.cron === cron);
}

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const schedules = findSchedulesByCron(controller.cron, env);
    if (schedules.length === 0) {
      console.log(`No enabled schedule found for cron ${controller.cron}`);
      return;
    }

    for (const schedule of schedules) {
      const workspaceId = resolveWorkspaceId(env.DEFAULT_WORKSPACE_ID);
      const task: QueueTask = {
        kind: "scheduled_job",
        traceId: crypto.randomUUID(),
        workspaceId,
        scheduleId: schedule.id,
        payload: {
          target: schedule.target,
          cron: schedule.cron,
          timeZone: schedule.timeZone,
          scheduledTime: new Date(controller.scheduledTime).toISOString()
        },
        enqueuedAt: new Date().toISOString()
      };

      await env.AUTOMATION_QUEUE.send(task);
      runtimeLog({
        level: "info",
        event: "scheduler.task_enqueued",
        traceId: task.traceId,
        workspaceId,
        scheduleId: schedule.id,
        status: "queued"
      });
      console.log(`Enqueued schedule ${schedule.id} trace=${task.traceId}`);
    }
  }
};
