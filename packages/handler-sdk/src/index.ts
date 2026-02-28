export type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

export type HandlerContext<Env = Record<string, unknown>> = {
  env: Env;
  traceId: string;
};

export type HttpHandler<Env = Record<string, unknown>> = (
  payload: unknown,
  context: HandlerContext<Env>
) => Promise<unknown> | unknown;

export type CronHandler<Env = Record<string, unknown>> = (
  payload: unknown,
  context: HandlerContext<Env> & { scheduleId: string }
) => Promise<unknown> | unknown;

export type HttpRouteRegistration<Env = Record<string, unknown>> = {
  id: string;
  mode: "sync" | "async";
  handler: HttpHandler<Env>;
  requiredSecrets?: string[];
};

export type CronRegistration<Env = Record<string, unknown>> = {
  id: string;
  cron: string;
  handler: CronHandler<Env>;
  requiredSecrets?: string[];
};

export function registerHttpRoutes<Env = Record<string, unknown>>(
  routes: HttpRouteRegistration<Env>[]
) {
  const byId = new Map(routes.map((route) => [route.id, route]));
  return {
    all: routes,
    get: (id: string) => byId.get(id)
  };
}

export function registerCronSchedules<Env = Record<string, unknown>>(
  schedules: CronRegistration<Env>[]
) {
  const byId = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  return {
    all: schedules,
    get: (id: string) => byId.get(id)
  };
}
