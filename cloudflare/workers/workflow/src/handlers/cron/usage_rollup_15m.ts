type RollupResult = {
  ok: true;
  schedule: "usage_rollup_15m";
  bucketMinutes: number;
  rolledAt: string;
};

export function handle(payload: unknown): RollupResult {
  const value = asRecord(payload);
  const bucketRaw = Number(value.bucketMinutes);
  const bucketMinutes = Number.isFinite(bucketRaw) && bucketRaw > 0 ? Math.floor(bucketRaw) : 15;

  return {
    ok: true,
    schedule: "usage_rollup_15m",
    bucketMinutes,
    rolledAt: new Date().toISOString()
  };
}
import { asRecord } from "../../lib/payload";
