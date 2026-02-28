import { unwrapBody } from "../../lib/payload";

type EchoResponse = {
  ok: true;
  route: "webhook_echo";
  received: unknown;
};

export function handle(requestPayload: unknown): EchoResponse {
  return {
    ok: true,
    route: "webhook_echo",
    received: unwrapBody(requestPayload)
  };
}
