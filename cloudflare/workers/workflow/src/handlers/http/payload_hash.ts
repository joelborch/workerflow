import { unwrapBody } from "../../lib/payload";

type HashResult = {
  ok: true;
  route: "payload_hash";
  algorithm: "SHA-256";
  hash: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handle(requestPayload: unknown): Promise<HashResult> {
  const body = unwrapBody(requestPayload);
  const payload = stableStringify(body);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));

  return {
    ok: true,
    route: "payload_hash",
    algorithm: "SHA-256",
    hash: toHex(digest)
  };
}
