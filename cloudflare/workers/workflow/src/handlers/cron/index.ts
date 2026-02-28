import type { Env } from "../../../../../shared/types";
import { handle as cleanupDaily } from "./cleanup_daily";
import { handle as configSnapshotDaily } from "./config_snapshot_daily";
import { handle as digestDaily } from "./digest_daily";
import { handle as heartbeatHourly } from "./heartbeat_hourly";
import { handle as retryDeadLettersHourly } from "./retry_dead_letters_hourly";
import { handle as usageRollup15m } from "./usage_rollup_15m";

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
  cleanup_daily: cleanupDaily,
  digest_daily: digestDaily,
  retry_dead_letters_hourly: retryDeadLettersHourly,
  usage_rollup_15m: usageRollup15m,
  config_snapshot_daily: configSnapshotDaily
};
