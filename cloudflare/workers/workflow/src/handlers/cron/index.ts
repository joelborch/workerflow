import type { Env } from "../../../../../shared/types";
import { handle as cleanupDaily } from "./cleanup_daily";
import { handle as heartbeatHourly } from "./heartbeat_hourly";

type CronContext = {
  env: Env;
  scheduleId: string;
};

export type CronScheduleHandler = (
  payload: unknown,
  traceId: string,
  context?: CronContext
) => unknown | Promise<unknown>;

export const CRON_SCHEDULE_HANDLERS: Record<string, CronScheduleHandler> = {
  heartbeat_hourly: heartbeatHourly,
  cleanup_daily: cleanupDaily
};
