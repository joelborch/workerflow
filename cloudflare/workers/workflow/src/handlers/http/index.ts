import type { Env } from "../../../../../shared/types";
import { handle as chatNotify } from "./chat_notify";
import { handle as leadNormalizer } from "./lead_normalizer";
import { handle as webhookEcho } from "./webhook_echo";

type HandlerContext = {
  env: Env;
};

export type HttpRouteHandler = (
  requestPayload: unknown,
  traceId: string,
  context?: HandlerContext
) => unknown | Promise<unknown>;

export const HTTP_ROUTE_HANDLERS: Record<string, HttpRouteHandler> = {
  webhook_echo: webhookEcho,
  chat_notify: chatNotify,
  lead_normalizer: leadNormalizer
};
