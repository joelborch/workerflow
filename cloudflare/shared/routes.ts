import type { RouteDefinition } from "./types";

export const ROUTES: RouteDefinition[] = [
  {
    routePath: "webhook_echo",
    requestType: "async",
    flowPath: "f/examples/webhook_echo",
    wrapBody: false
  },
  {
    routePath: "chat_notify",
    requestType: "async",
    flowPath: "f/examples/chat_notify",
    wrapBody: true
  },
  {
    routePath: "slack_message",
    requestType: "async",
    flowPath: "f/examples/slack_message",
    wrapBody: true
  },
  {
    routePath: "github_issue_create",
    requestType: "async",
    flowPath: "f/examples/github_issue_create",
    wrapBody: true
  },
  {
    routePath: "openai_chat",
    requestType: "sync",
    flowPath: "f/examples/openai_chat",
    wrapBody: true
  },
  {
    routePath: "stripe_payment_intent_create",
    requestType: "sync",
    flowPath: "f/examples/stripe_payment_intent_create",
    wrapBody: true
  },
  {
    routePath: "stripe_customer_upsert",
    requestType: "sync",
    flowPath: "f/examples/stripe_customer_upsert",
    wrapBody: true
  },
  {
    routePath: "notion_database_item_create",
    requestType: "sync",
    flowPath: "f/examples/notion_database_item_create",
    wrapBody: true
  },
  {
    routePath: "notion_database_item_get",
    requestType: "sync",
    flowPath: "f/examples/notion_database_item_get",
    wrapBody: true
  },
  {
    routePath: "hubspot_contact_upsert",
    requestType: "sync",
    flowPath: "f/examples/hubspot_contact_upsert",
    wrapBody: true
  },
  {
    routePath: "hubspot_deal_upsert",
    requestType: "sync",
    flowPath: "f/examples/hubspot_deal_upsert",
    wrapBody: true
  },
  {
    routePath: "lead_normalizer",
    requestType: "sync",
    flowPath: "f/examples/lead_normalizer",
    wrapBody: true
  },
  {
    routePath: "json_transform",
    requestType: "sync",
    flowPath: "f/examples/json_transform",
    wrapBody: true
  },
  {
    routePath: "text_extract",
    requestType: "sync",
    flowPath: "f/examples/text_extract",
    wrapBody: true
  },
  {
    routePath: "payload_hash",
    requestType: "sync",
    flowPath: "f/examples/payload_hash",
    wrapBody: true
  },
  {
    routePath: "template_render",
    requestType: "sync",
    flowPath: "f/examples/template_render",
    wrapBody: true
  },
  {
    routePath: "timestamp_enrich",
    requestType: "async",
    flowPath: "f/examples/timestamp_enrich",
    wrapBody: true
  },
  {
    routePath: "webhook_fanout",
    requestType: "async",
    flowPath: "f/examples/webhook_fanout",
    wrapBody: true
  },
  {
    routePath: "incident_create",
    requestType: "async",
    flowPath: "f/examples/incident_create",
    wrapBody: true
  },
  {
    routePath: "health_note",
    requestType: "sync",
    flowPath: "f/examples/health_note",
    wrapBody: true
  },
  {
    routePath: "noop_ack",
    requestType: "async",
    flowPath: "f/examples/noop_ack",
    wrapBody: false
  }
];

const routeMap = new Map(ROUTES.map((route) => [route.routePath, route]));

export function getRoute(routePath: string) {
  return routeMap.get(routePath);
}
