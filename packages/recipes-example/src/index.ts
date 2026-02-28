export const EXAMPLE_ROUTES = [
  {
    id: "example_ping",
    mode: "sync" as const,
    description: "Simple example route that echoes request metadata."
  }
];

export const EXAMPLE_SCHEDULES = [
  {
    id: "example_daily_healthcheck",
    cron: "0 0 * * *",
    description: "Simple daily schedule example."
  }
];
