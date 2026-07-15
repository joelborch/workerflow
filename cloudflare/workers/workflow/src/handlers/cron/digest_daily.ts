type DigestResult = {
  ok: true;
  schedule: "digest_daily";
  generatedAt: string;
  channel: string;
};

export function handle(payload: unknown): DigestResult {
  const value = asRecord(payload);
  const channel = typeof value.channel === "string" && value.channel.trim().length > 0 ? value.channel.trim() : "ops";

  return {
    ok: true,
    schedule: "digest_daily",
    generatedAt: new Date().toISOString(),
    channel
  };
}
import { asRecord } from "../../lib/payload";
