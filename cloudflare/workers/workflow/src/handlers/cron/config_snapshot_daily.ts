type SnapshotResult = {
  ok: true;
  schedule: "config_snapshot_daily";
  includeDisabled: boolean;
  snapshottedAt: string;
};

type SnapshotPayload = {
  includeDisabled?: unknown;
};

export function handle(payload: unknown): SnapshotResult {
  const value = payload && typeof payload === "object" ? (payload as SnapshotPayload) : {};

  return {
    ok: true,
    schedule: "config_snapshot_daily",
    includeDisabled: value.includeDisabled === true,
    snapshottedAt: new Date().toISOString()
  };
}
