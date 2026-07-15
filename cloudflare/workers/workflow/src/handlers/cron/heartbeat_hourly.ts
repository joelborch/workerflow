import { asRecord } from "../../lib/payload";

type HeartbeatResult = {
  ok: true;
  schedule: "heartbeat_hourly";
  target: string;
  scheduledTime: string;
  processedAt: string;
};

export function handle(payload: unknown): HeartbeatResult {
  const value = asRecord(payload);
  const target = typeof value.target === "string" ? value.target : "f/examples/heartbeat_hourly";
  const scheduledTime = typeof value.scheduledTime === "string" ? value.scheduledTime : new Date().toISOString();

  return {
    ok: true,
    schedule: "heartbeat_hourly",
    target,
    scheduledTime,
    processedAt: new Date().toISOString()
  };
}
