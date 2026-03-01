export type ConnectorAuthStrategy = "oauth2" | "api_key" | "token" | "webhook" | "basic" | "none" | "mixed";

export type ConnectorRouteRequirement = {
  routePath: string;
  label: string;
  requiredSecrets: string[];
};

export type RuntimeConnectorSpec = {
  id: string;
  displayName: string;
  docsUrl: string;
  authStrategy: ConnectorAuthStrategy;
  routeRequirements: ConnectorRouteRequirement[];
};

type ConnectorSecretGroup = {
  id: string;
  requiredSecrets: string[];
  routes: string[];
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export const RUNTIME_CONNECTOR_SPECS: RuntimeConnectorSpec[] = [
  {
    id: "chat",
    displayName: "Generic Chat Webhook",
    docsUrl: "https://developers.google.com/workspace/chat/quickstart/webhooks",
    authStrategy: "webhook",
    routeRequirements: [
      {
        routePath: "chat_notify",
        label: "chat webhook URL",
        requiredSecrets: ["CHAT_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK"]
      },
      {
        routePath: "incident_create",
        label: "chat webhook URL",
        requiredSecrets: ["CHAT_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK"]
      }
    ]
  },
  {
    id: "slack",
    displayName: "Slack",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    authStrategy: "webhook",
    routeRequirements: [
      {
        routePath: "slack_message",
        label: "Slack webhook URL",
        requiredSecrets: ["SLACK_WEBHOOK_URL"]
      }
    ]
  },
  {
    id: "github",
    displayName: "GitHub",
    docsUrl: "https://docs.github.com/en/rest/issues/issues",
    authStrategy: "token",
    routeRequirements: [
      {
        routePath: "github_issue_create",
        label: "GitHub token",
        requiredSecrets: ["GITHUB_TOKEN"]
      }
    ]
  },
  {
    id: "openai",
    displayName: "OpenAI",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
    authStrategy: "api_key",
    routeRequirements: [
      {
        routePath: "openai_chat",
        label: "OpenAI API key",
        requiredSecrets: ["OPENAI_API_KEY"]
      }
    ]
  },
  {
    id: "stripe",
    displayName: "Stripe",
    docsUrl: "https://docs.stripe.com/api",
    authStrategy: "api_key",
    routeRequirements: [
      {
        routePath: "stripe_payment_intent_create",
        label: "Stripe API key",
        requiredSecrets: ["STRIPE_API_KEY"]
      },
      {
        routePath: "stripe_customer_upsert",
        label: "Stripe API key",
        requiredSecrets: ["STRIPE_API_KEY"]
      }
    ]
  },
  {
    id: "notion",
    displayName: "Notion",
    docsUrl: "https://developers.notion.com/reference/intro",
    authStrategy: "token",
    routeRequirements: [
      {
        routePath: "notion_database_item_create",
        label: "Notion token",
        requiredSecrets: ["NOTION_TOKEN"]
      },
      {
        routePath: "notion_database_item_get",
        label: "Notion token",
        requiredSecrets: ["NOTION_TOKEN"]
      }
    ]
  },
  {
    id: "hubspot",
    displayName: "HubSpot",
    docsUrl: "https://developers.hubspot.com/docs/api-reference/overview",
    authStrategy: "oauth2",
    routeRequirements: [
      {
        routePath: "hubspot_contact_upsert",
        label: "HubSpot access token",
        requiredSecrets: ["HUBSPOT_ACCESS_TOKEN"]
      },
      {
        routePath: "hubspot_deal_upsert",
        label: "HubSpot access token",
        requiredSecrets: ["HUBSPOT_ACCESS_TOKEN"]
      }
    ]
  },
  {
    id: "lead_normalizer_ai",
    displayName: "Lead Normalizer AI",
    docsUrl: "https://ai.google.dev/gemini-api/docs/text-generation",
    authStrategy: "api_key",
    routeRequirements: [
      {
        routePath: "lead_normalizer",
        label: "Google AI key",
        requiredSecrets: ["GOOGLEAI_API_KEY", "LEAD_NORMALIZER_API_KEY"]
      }
    ]
  }
];

const ROUTE_SECRET_REQUIREMENT_MAP = new Map<string, ConnectorRouteRequirement>(
  RUNTIME_CONNECTOR_SPECS.flatMap((connector) =>
    connector.routeRequirements.map((requirement) => [requirement.routePath, requirement] as const)
  )
);

export function getRouteSecretRequirement(routePath: string): ConnectorRouteRequirement | null {
  return ROUTE_SECRET_REQUIREMENT_MAP.get(routePath) ?? null;
}

export function listRuntimeConnectorSecrets(): ConnectorSecretGroup[] {
  return RUNTIME_CONNECTOR_SPECS.map((connector) => ({
    id: connector.id,
    requiredSecrets: uniqueSorted(connector.routeRequirements.flatMap((requirement) => requirement.requiredSecrets)),
    routes: uniqueSorted(connector.routeRequirements.map((requirement) => requirement.routePath))
  }));
}
