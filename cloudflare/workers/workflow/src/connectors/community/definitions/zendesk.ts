import { createConnectorScaffold } from "../define";

export const zendeskConnector = createConnectorScaffold({
  "id": "zendesk",
  "displayName": "Zendesk",
  "description": "Support ticket automation and customer service routing.",
  "providerUrl": "https://www.zendesk.com",
  "docsUrl": "https://developer.zendesk.com/api-reference",
  "categories": [
    "support",
    "customer-success"
  ],
  "authStrategy": "basic",
  "requiredSecrets": [
    "ZENDESK_SUBDOMAIN",
    "ZENDESK_EMAIL",
    "ZENDESK_API_TOKEN"
  ],
  "triggers": [
    {
      "key": "ticket_updated",
      "title": "Ticket Updated",
      "summary": "Run when a support ticket changes state."
    }
  ],
  "actions": [
    {
      "key": "create_ticket",
      "title": "Create Ticket",
      "summary": "Create a ticket with requester and comment text."
    }
  ]
});
