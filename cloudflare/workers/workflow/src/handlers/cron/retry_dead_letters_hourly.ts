type RetryResult = {
  ok: true;
  schedule: "retry_dead_letters_hourly";
  maxRetries: number;
  dryRun: boolean;
};

export function handle(payload: unknown): RetryResult {
  const value = asRecord(payload);
  const maxRetriesRaw = Number(value.maxRetries);
  const maxRetries = Number.isFinite(maxRetriesRaw) && maxRetriesRaw > 0 ? Math.floor(maxRetriesRaw) : 50;

  return {
    ok: true,
    schedule: "retry_dead_letters_hourly",
    maxRetries,
    dryRun: value.dryRun === true
  };
}
import { asRecord } from "../../lib/payload";
