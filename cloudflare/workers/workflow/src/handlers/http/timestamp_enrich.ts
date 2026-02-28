import { unwrapBody } from "../../lib/payload";

type EnrichResult = {
  ok: true;
  route: "timestamp_enrich";
  receivedAt: string;
  unixMs: number;
  payload: unknown;
};

export function handle(requestPayload: unknown): EnrichResult {
  const now = new Date();
  return {
    ok: true,
    route: "timestamp_enrich",
    receivedAt: now.toISOString(),
    unixMs: now.getTime(),
    payload: unwrapBody(requestPayload)
  };
}
