import assert from "node:assert/strict";

import { SCHEDULES } from "../shared/schedules";
import type { Env, QueueTask } from "../shared/types";
import schedulerWorker from "../workers/scheduler/src/index";

function makeEnv(queued: QueueTask[]): Env {
  return {
    DB: {} as D1Database,
    WORKFLOW_SERVICE: {} as Fetcher,
    ENV_NAME: "test",
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queued.push(task);
      }
    } as unknown as Queue<QueueTask>
  };
}

function makeController(cron: string, scheduledTime: number) {
  return {
    cron,
    scheduledTime
  } as ScheduledController;
}

function isIsoTimestamp(value: string) {
  return Number.isFinite(Date.parse(value));
}

async function run() {
  const queued: QueueTask[] = [];
  const env = makeEnv(queued);
  const scheduledTimeMs = Date.parse("2026-02-28T12:00:00.000Z");
  const expectedScheduledTimeIso = new Date(scheduledTimeMs).toISOString();

  const enabledSchedules = SCHEDULES.filter((item) => item.enabled);
  const uniqueCrons = Array.from(new Set(enabledSchedules.map((item) => item.cron)));

  for (const cron of uniqueCrons) {
    await schedulerWorker.scheduled(makeController(cron, scheduledTimeMs), env);
  }

  assert.equal(queued.length, enabledSchedules.length, "scheduler should enqueue one task per enabled schedule");

  const byScheduleId = new Map(queued.map((task) => [task.scheduleId ?? "", task]));
  for (const schedule of enabledSchedules) {
    const task = byScheduleId.get(schedule.id);
    assert.ok(task, `missing queued task for schedule ${schedule.id}`);
    assert.equal(task?.kind, "scheduled_job");
    assert.equal(task?.scheduleId, schedule.id);
    assert.ok(task?.traceId && task.traceId.length > 0);
    assert.ok(isIsoTimestamp(task?.enqueuedAt ?? ""), "enqueuedAt must be a valid ISO timestamp");

    const payload = (task?.payload ?? {}) as Record<string, unknown>;
    assert.equal(payload.target, schedule.target);
    assert.equal(payload.cron, schedule.cron);
    assert.equal(payload.timeZone, schedule.timeZone);
    assert.equal(payload.scheduledTime, expectedScheduledTimeIso);
  }

  const beforeUnknownCron = queued.length;
  await schedulerWorker.scheduled(makeController("*/5 * * * *", scheduledTimeMs), env);
  assert.equal(queued.length, beforeUnknownCron, "unknown cron should not enqueue tasks");

  console.log(`schedule fixture tests passed: enabledSchedules=${enabledSchedules.length}`);
}

run().catch((error) => {
  console.error("schedule fixture tests failed", error);
  process.exitCode = 1;
});
