type RetryResult = {
  ok: true;
  schedule: "retry_dead_letters_hourly";
  maxRetries: number;
  dryRun: boolean;
};

type RetryPayload = {
  maxRetries?: unknown;
  dryRun?: unknown;
};

export function handle(payload: unknown): RetryResult {
  const value = payload && typeof payload === "object" ? (payload as RetryPayload) : {};
  const maxRetriesRaw = Number(value.maxRetries);
  const maxRetries = Number.isFinite(maxRetriesRaw) && maxRetriesRaw > 0 ? Math.floor(maxRetriesRaw) : 50;

  return {
    ok: true,
    schedule: "retry_dead_letters_hourly",
    maxRetries,
    dryRun: value.dryRun === true
  };
}
