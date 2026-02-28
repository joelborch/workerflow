import type { Env } from "../../../../../shared/types";
import { handle as chatNotify } from "./chat_notify";
import { handle as githubIssueCreate } from "./github_issue_create";
import { handle as healthNote } from "./health_note";
import { handle as hubspotContactUpsert } from "./hubspot_contact_upsert";
import { handle as hubspotDealUpsert } from "./hubspot_deal_upsert";
import { handle as incidentCreate } from "./incident_create";
import { handle as jsonTransform } from "./json_transform";
import { handle as leadNormalizer } from "./lead_normalizer";
import { handle as noopAck } from "./noop_ack";
import { handle as notionDatabaseItemCreate } from "./notion_database_item_create";
import { handle as notionDatabaseItemGet } from "./notion_database_item_get";
import { handle as openAiChat } from "./openai_chat";
import { handle as payloadHash } from "./payload_hash";
import { handle as slackMessage } from "./slack_message";
import { handle as stripeCustomerUpsert } from "./stripe_customer_upsert";
import { handle as stripePaymentIntentCreate } from "./stripe_payment_intent_create";
import { handle as templateRender } from "./template_render";
import { handle as textExtract } from "./text_extract";
import { handle as timestampEnrich } from "./timestamp_enrich";
import { handle as webhookEcho } from "./webhook_echo";
import { handle as webhookFanout } from "./webhook_fanout";

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
  slack_message: slackMessage,
  github_issue_create: githubIssueCreate,
  openai_chat: openAiChat,
  stripe_payment_intent_create: stripePaymentIntentCreate,
  stripe_customer_upsert: stripeCustomerUpsert,
  notion_database_item_create: notionDatabaseItemCreate,
  notion_database_item_get: notionDatabaseItemGet,
  hubspot_contact_upsert: hubspotContactUpsert,
  hubspot_deal_upsert: hubspotDealUpsert,
  lead_normalizer: leadNormalizer,
  json_transform: jsonTransform,
  text_extract: textExtract,
  payload_hash: payloadHash,
  template_render: templateRender,
  timestamp_enrich: timestampEnrich,
  webhook_fanout: webhookFanout,
  incident_create: incidentCreate,
  health_note: healthNote,
  noop_ack: noopAck
};
