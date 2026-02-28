import { unwrapBody } from "../../lib/payload";

type NoopAckResult = {
  ok: true;
  route: "noop_ack";
  acknowledged: boolean;
  received: unknown;
};

export function handle(requestPayload: unknown): NoopAckResult {
  return {
    ok: true,
    route: "noop_ack",
    acknowledged: true,
    received: unwrapBody(requestPayload)
  };
}
