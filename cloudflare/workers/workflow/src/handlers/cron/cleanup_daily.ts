import type { Env } from "../../../../../shared/types";

type CronContext = {
  env: Env;
};

type CleanupResult = {
  ok: true;
  schedule: "cleanup_daily";
  dryRun: boolean;
  retentionDays: number;
};

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

export async function handle(payload: unknown, _traceId: string, context?: CronContext): Promise<CleanupResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Cron execution context missing env");
  }

  const secret = envString(env, "CLEANUP_SIGNING_SECRET");
  if (!secret) {
    throw new Error("CLEANUP_SIGNING_SECRET is required");
  }

  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const dryRun = body.dryRun === true;
  const requestedRetention = Number(body.retentionDays);
  const retentionDays = Number.isFinite(requestedRetention) && requestedRetention > 0 ? Math.floor(requestedRetention) : 30;

  return {
    ok: true,
    schedule: "cleanup_daily",
    dryRun,
    retentionDays
  };
}
