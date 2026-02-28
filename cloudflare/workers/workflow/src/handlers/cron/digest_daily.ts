type DigestResult = {
  ok: true;
  schedule: "digest_daily";
  generatedAt: string;
  channel: string;
};

type DigestPayload = {
  channel?: unknown;
};

export function handle(payload: unknown): DigestResult {
  const value = payload && typeof payload === "object" ? (payload as DigestPayload) : {};
  const channel = typeof value.channel === "string" && value.channel.trim().length > 0 ? value.channel.trim() : "ops";

  return {
    ok: true,
    schedule: "digest_daily",
    generatedAt: new Date().toISOString(),
    channel
  };
}
