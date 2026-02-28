import { createConnectorScaffold } from "../define";

export const intercomConnector = createConnectorScaffold({
  "id": "intercom",
  "displayName": "Intercom",
  "description": "Customer messaging and support lifecycle automations.",
  "providerUrl": "https://www.intercom.com",
  "docsUrl": "https://developers.intercom.com",
  "categories": [
    "support",
    "customer-success"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "INTERCOM_ACCESS_TOKEN"
  ],
  "triggers": [
    {
      "key": "conversation_created",
      "title": "Conversation Created",
      "summary": "Run when a new conversation starts."
    }
  ],
  "actions": [
    {
      "key": "create_contact",
      "title": "Create Contact",
      "summary": "Create or update an Intercom contact."
    }
  ]
});
