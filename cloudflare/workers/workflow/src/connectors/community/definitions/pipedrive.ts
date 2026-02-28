import { createConnectorScaffold } from "../define";

export const pipedriveConnector = createConnectorScaffold({
  "id": "pipedrive",
  "displayName": "Pipedrive",
  "description": "Sales pipeline automations for leads, people, and deals.",
  "providerUrl": "https://www.pipedrive.com",
  "docsUrl": "https://developers.pipedrive.com/docs/api/v1",
  "categories": [
    "crm",
    "sales"
  ],
  "authStrategy": "token",
  "requiredSecrets": [
    "PIPEDRIVE_API_TOKEN"
  ],
  "triggers": [
    {
      "key": "deal_updated",
      "title": "Deal Updated",
      "summary": "Run when a deal is updated in a pipeline."
    }
  ],
  "actions": [
    {
      "key": "create_activity",
      "title": "Create Activity",
      "summary": "Create a follow-up activity for a deal or person."
    }
  ]
});
