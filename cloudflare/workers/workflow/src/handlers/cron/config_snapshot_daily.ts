type SnapshotResult = {
  ok: true;
  schedule: "config_snapshot_daily";
  includeDisabled: boolean;
  snapshottedAt: string;
};

export function handle(payload: unknown): SnapshotResult {
  const value = asRecord(payload);

  return {
    ok: true,
    schedule: "config_snapshot_daily",
    includeDisabled: value.includeDisabled === true,
    snapshottedAt: new Date().toISOString()
  };
}
import { asRecord } from "../../lib/payload";
