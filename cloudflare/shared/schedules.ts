import type { ScheduleDefinition } from "./types";

export const SCHEDULES: ScheduleDefinition[] = [
  {
    id: "heartbeat_hourly",
    cron: "0 * * * *",
    enabled: true,
    target: "f/examples/heartbeat_hourly",
    timeZone: "UTC"
  },
  {
    id: "cleanup_daily",
    cron: "0 3 * * *",
    enabled: true,
    target: "f/examples/cleanup_daily",
    timeZone: "UTC"
  }
];
