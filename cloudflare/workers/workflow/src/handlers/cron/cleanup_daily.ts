import type { Env } from "../../../../../shared/types";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";

type CleanupResult = {
  ok: true;
  schedule: "cleanup_daily";
  dryRun: boolean;
  retentionDays: number;
};

export async function handle(payload: unknown, _traceId: string, context?: EnvContext<Env>): Promise<CleanupResult> {
  const env = requireContextEnv(context, "Cron execution context missing env");

  const secret = readEnvString(env, ["CLEANUP_SIGNING_SECRET"]);
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
